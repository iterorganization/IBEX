import { expect } from 'chai';
import { cloneGridStructure } from './cloneGrid';
import { DataGridPlot } from '../types';

const gridWith = (): DataGridPlot =>
  ({
    i: 'grid-1',
    title: 'psi',
    synchronizedGrids: { color: 'blue', list: ['grid-2'] },
    xAxisData: { name: 'time', path: 'time', unit: 's' },
    coordinates: [
      { name: 'time', axeIndex: 0, valueIndex: 3, data: [0, 1, 2] },
    ],
    plot: [
      {
        nodeUri: 'u#a',
        yData: [
          [1, 2],
          [3, 4],
        ],
        error_bands: [{ path: 'u#a_error_upper', yData: [9, 9], array: [] }],
      },
    ],
    geometries: [{ name: 'outline', x: [0, 1], y: [2, 3] }],
  }) as unknown as DataGridPlot;

describe('cloneGridStructure', () => {
  it('copies every object a transform writes fields on', () => {
    const grid = gridWith();
    const copy = cloneGridStructure(grid);

    expect(copy).to.not.equal(grid);
    expect(copy.coordinates[0]).to.not.equal(grid.coordinates[0]);
    expect(copy.plot[0]).to.not.equal(grid.plot[0]);
    expect(copy.plot[0].error_bands[0]).to.not.equal(
      grid.plot[0].error_bands[0],
    );
    expect(copy.geometries[0]).to.not.equal(grid.geometries[0]);
    expect(copy.xAxisData).to.not.equal(grid.xAxisData);
    expect(copy.synchronizedGrids.list).to.not.equal(
      grid.synchronizedGrids.list,
    );
  });

  it('shares the payload arrays rather than copying them', () => {
    const grid = gridWith();
    const copy = cloneGridStructure(grid);

    expect(copy.plot[0].yData).to.equal(grid.plot[0].yData);
    expect(copy.coordinates[0].data).to.equal(grid.coordinates[0].data);
    expect(copy.plot[0].error_bands[0].yData).to.equal(
      grid.plot[0].error_bands[0].yData,
    );
    expect(copy.geometries[0].x).to.equal(grid.geometries[0].x);
  });

  it('leaves the original untouched when the copy is written to', () => {
    const grid = gridWith();
    const copy = cloneGridStructure(grid);

    copy.coordinates[0].valueIndex = 7;
    copy.plot[0].yData = [[5, 6]];
    copy.xAxisData.name = 'rho';

    expect(grid.coordinates[0].valueIndex).to.equal(3);
    expect(grid.plot[0].yData).to.deep.equal([
      [1, 2],
      [3, 4],
    ]);
    expect(grid.xAxisData.name).to.equal('time');
  });

  it('survives a grid with no coordinates, geometries or bands', () => {
    const copy = cloneGridStructure({ i: 'empty' } as unknown as DataGridPlot);
    expect(copy.i).to.equal('empty');
    expect(copy.coordinates).to.equal(undefined);
  });
});
