import { expect } from 'chai';
import type { DataPlotly } from '../types';
import {
  commonCoordinatesChange,
  getUrisToInterpolate,
  sourceOf,
} from './plotSources';

const plots = (...nodeUris: string[]) =>
  nodeUris.map((nodeUri) => ({ nodeUri }) as DataPlotly);

const IP = 'global_quantities/ip/value';

describe('sourceOf', () => {
  it('reads an occurrence left out as occurrence 0', () => {
    expect(sourceOf(`URI-1#summary/${IP}`)).to.deep.equal({
      entry: 'URI-1',
      ids: 'summary',
      occurrence: 0,
      path: IP,
    });
    expect(sourceOf(`URI-1#summary:2/${IP}`).occurrence).to.equal(2);
  });

  it('normalizes indices', () => {
    expect(sourceOf('URI-0#equilibrium:1/time_slice[3]/psi').path).to.equal(
      'time_slice[:]/psi',
    );
  });
});

describe('getUrisToInterpolate', () => {
  it('interpolates over the other occurrence of the same entry', () => {
    expect(
      getUrisToInterpolate(
        `URI-1#summary:1/${IP}`,
        plots(`URI-1#summary:0/${IP}`, `URI-1#summary:1/${IP}`),
      ),
    ).to.deep.equal([`URI-1#summary:0/${IP}`]);
  });

  it('takes the occurrence of the other source, not its own', () => {
    expect(
      getUrisToInterpolate(
        `URI-0#summary:0/${IP}`,
        plots(`URI-0#summary:0/${IP}`, `URI-1#summary:1/${IP}`),
      ),
    ).to.deep.equal([`URI-1#summary:1/${IP}`]);
  });

  it('counts an implicit and an explicit occurrence 0 as one source', () => {
    expect(
      getUrisToInterpolate(`URI-1#summary/${IP}`, plots(`URI-1#summary:0/x`)),
    ).to.deep.equal([]);
  });

  it('builds the node of the trace itself in every other source', () => {
    expect(
      getUrisToInterpolate(
        `URI-0#summary:0/${IP}_error_upper`,
        plots(`URI-0#summary:0/${IP}`, `URI-1#summary:0/tau_energy`),
      ),
    ).to.deep.equal([`URI-1#summary:0/${IP}_error_upper`]);
  });
});

describe('commonCoordinatesChange', () => {
  it('is true when another occurrence of an entry joins the grid', () => {
    expect(
      commonCoordinatesChange(
        plots(`URI-1#summary:0/${IP}`),
        `URI-1#summary:1/${IP}`,
      ),
    ).to.equal(true);
  });

  it('is false when the source is already in the grid', () => {
    expect(
      commonCoordinatesChange(
        plots(`URI-1#summary:1/${IP}`),
        'URI-1#summary:1/global_quantities/tau_energy/value',
      ),
    ).to.equal(false);
  });
});
