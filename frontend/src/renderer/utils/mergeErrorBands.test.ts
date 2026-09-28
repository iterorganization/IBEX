import { expect } from 'chai';
import { mergeErrorBands } from './mergeErrorBands';
import { cloneGridStructure } from './cloneGrid';
import { Configuration, DataGridPlot } from '../types';

const grid = (i: string, valueIndex = 0): DataGridPlot =>
  ({
    i,
    synchronizedGrids: { color: '', list: [] },
    coordinates: [{ name: 'time', valueIndex, data: [0, 1, 2] }],
    plot: [{ nodeUri: `u#${i}`, yData: [1, 2, 3] }],
  }) as unknown as DataGridPlot;

const configuration = (...grids: DataGridPlot[]): Configuration =>
  ({ name: 'c', checkedNodeURI: [], dataPlot: grids }) as Configuration;

const workingCopyOf = (start: Configuration): Configuration => ({
  ...start,
  checkedNodeURI: [...start.checkedNodeURI],
  dataPlot: start.dataPlot.map(cloneGridStructure),
});

const band = (path: string) => ({ path, yData: [0.1], yDataRef: `${path}#v` });

describe('mergeErrorBands', () => {
  it('keeps what was written while the bands were being fetched', () => {
    const start = configuration(grid('a'), grid('b'));
    const working = workingCopyOf(start);
    working.dataPlot[0].plot[0].error_bands = [band('u#a_error_upper')];
    working.checkedNodeURI.push({ name: 'a', uri: 'u#a_error_upper' } as never);

    // Meanwhile: a slider moved both grids and the grids were linked.
    const latest = configuration(
      { ...grid('a', 2), synchronizedGrids: { color: 'x', list: ['b'] } },
      { ...grid('b', 2), synchronizedGrids: { color: 'x', list: ['a'] } },
    );

    const merged = mergeErrorBands(latest, start, working);

    expect(merged.dataPlot[0].coordinates[0].valueIndex).to.equal(2);
    expect(merged.dataPlot[1].coordinates[0].valueIndex).to.equal(2);
    expect(merged.dataPlot[0].synchronizedGrids.list).to.deep.equal(['b']);
    expect(merged.dataPlot[0].plot[0].error_bands).to.deep.equal([
      band('u#a_error_upper'),
    ]);
    expect(merged.dataPlot[1]).to.equal(latest.dataPlot[1]);
    expect(merged.checkedNodeURI.map((node) => node.uri)).to.deep.equal([
      'u#a_error_upper',
    ]);
  });

  it('writes nothing when the fetch changed nothing', () => {
    const start = configuration(grid('a'));
    expect(mergeErrorBands(start, start, workingCopyOf(start))).to.equal(null);
  });

  it('writes nothing when the active configuration changed meanwhile', () => {
    const start = configuration(grid('a'));
    const working = workingCopyOf(start);
    working.dataPlot[0].plot[0].error_bands = [band('u#a_error_upper')];
    const other = { ...configuration(grid('a')), name: 'other' };

    expect(mergeErrorBands(other, start, working)).to.equal(null);
    expect(mergeErrorBands(null, start, working)).to.equal(null);
  });

  it('carries a removal across, bands and checked nodes', () => {
    const withBands = grid('a');
    withBands.plot[0].error_bands = [band('u#a_error_upper')];
    const start = {
      ...configuration(withBands),
      checkedNodeURI: [{ name: 'a', uri: 'u#a_error_upper' }],
    } as Configuration;
    const working = workingCopyOf(start);
    delete working.dataPlot[0].plot[0].error_bands;
    working.checkedNodeURI = [];

    const merged = mergeErrorBands(start, start, working);

    expect(merged.dataPlot[0].plot[0]).to.not.have.property('error_bands');
    expect(merged.checkedNodeURI).to.deep.equal([]);
  });
});
