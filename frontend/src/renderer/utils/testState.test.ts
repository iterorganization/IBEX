import { expect } from 'chai';
import { mergeTestState } from './testState';
import { Configuration, TestState } from '../types';

const configuration = (name: string, title: string): Configuration =>
  ({
    name,
    dataPlot: [],
    saved: title === 'after',
  }) as unknown as Configuration;

describe('mergeTestState', () => {
  it('re-links an active written alone to its entry in configurations', () => {
    const stale = configuration('a', 'before');
    const other = configuration('b', 'untouched');
    const current = {
      configurations: [stale, other],
      active: stale,
    } as unknown as TestState;

    const merged = mergeTestState(
      { active: configuration('a', 'after') },
      current,
    );

    expect(merged.configurations[0]).to.equal(merged.active);
    expect(merged.configurations[0].saved).to.equal(true);
    expect(merged.configurations[1]).to.equal(other);
  });

  it('leaves configurations alone when active is not written', () => {
    const current = {
      configurations: [configuration('a', 'x')],
      active: null,
    } as unknown as TestState;

    const merged = mergeTestState({ editingGridId: null }, current);

    expect(merged).to.not.have.property('configurations');
  });
});
