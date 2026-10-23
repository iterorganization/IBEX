import { expect } from 'chai';
import type { DataPlotly } from '../types';
import {
  commonCoordinatesChange,
  getUrisToInterpolate,
  plotTabLabels,
  sourceOf,
} from './plotSources';

const plots = (...nodeUris: string[]) =>
  nodeUris.map((nodeUri) => ({ nodeUri }) as DataPlotly);

const IP = 'global_quantities/ip/value';
const CP_IP = 'global_quantities/ip';
const EQ_IP = 'time_slice[:]/global_quantities/ip';

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
      getUrisToInterpolate(
        `URI-1#summary/${IP}`,
        plots(`URI-1#summary:0/global_quantities/tau_energy/value`),
      ),
    ).to.deep.equal([]);
  });

  it('takes the node drawn from another IDS of the same entry', () => {
    expect(
      getUrisToInterpolate(
        `URI-1#summary:0/${IP}`,
        plots(`URI-1#core_profiles:0/${CP_IP}`, `URI-1#summary:0/${IP}`),
      ),
    ).to.deep.equal([`URI-1#core_profiles:0/${CP_IP}`]);
    expect(
      getUrisToInterpolate(
        `URI-1#core_profiles:0/${CP_IP}`,
        plots(`URI-1#summary:1/${IP}`),
      ),
    ).to.deep.equal([`URI-1#summary:1/${IP}`]);
  });

  it('takes the node of another IDS with its indices normalized', () => {
    expect(
      getUrisToInterpolate(
        `URI-0#summary:0/${IP}`,
        plots(`URI-0#equilibrium:0/time_slice[0]/global_quantities/ip`),
      ),
    ).to.deep.equal([`URI-0#equilibrium:0/${EQ_IP}`]);
  });

  it('takes a single node of a source of another IDS', () => {
    expect(
      getUrisToInterpolate(
        `URI-0#summary:0/${IP}`,
        plots(
          `URI-0#core_profiles:0/${CP_IP}`,
          'URI-0#core_profiles:0/global_quantities/v_loop',
        ),
      ),
    ).to.deep.equal([`URI-0#core_profiles:0/${CP_IP}`]);
  });

  it('takes its own node in the sources of its IDS only', () => {
    expect(
      getUrisToInterpolate(
        `URI-0#core_profiles:0/${CP_IP}`,
        plots(`URI-1#summary:1/${IP}`, `URI-1#core_profiles:2/${CP_IP}`),
      ),
    ).to.deep.equal([
      `URI-1#summary:1/${IP}`,
      `URI-1#core_profiles:2/${CP_IP}`,
    ]);
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

  it('is true when another IDS of an entry joins the grid', () => {
    expect(
      commonCoordinatesChange(
        plots(`URI-1#summary:1/${IP}`),
        `URI-1#core_profiles:0/${CP_IP}`,
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

describe('plotTabLabels', () => {
  const named = (...traces: [string, string, string][]) =>
    traces.map(
      ([nodeUri, labelUri, name]) =>
        ({ nodeUri, labelUri, name }) as DataPlotly,
    );

  it('keeps a name no other trace shares', () => {
    const labels = plotTabLabels(
      named([`URI-0#summary:1/${IP}`, 'URI-0', 'ip_URI-0']),
    );
    expect(labels.get(`URI-0#summary:1/${IP}`)).to.equal('ip_URI-0');
  });

  it('tells traces of one entry apart by the end of their paths', () => {
    const labels = plotTabLabels(
      named(
        ['URI-0#magnetics/ip/0/measured', 'URI-0', 'measured_URI-0'],
        [
          'URI-0#magnetics/diamagnetic_flux/0/measured',
          'URI-0',
          'measured_URI-0',
        ],
      ),
    );
    expect([...labels.values()]).to.deep.equal([
      'ip/0/measured_URI-0',
      'diamagnetic_flux/0/measured_URI-0',
    ]);
  });

  it('tells the occurrences of one node apart by IDS and occurrence', () => {
    const labels = plotTabLabels(
      named(
        [`URI-0#summary:1/${IP}`, 'URI-0', 'ip_URI-0'],
        [`URI-1#summary:1/${IP}`, 'URI-1', 'ip_URI-1'],
        [`URI-1#summary/${IP}`, 'URI-1', 'ip_URI-1'],
      ),
    );
    expect([...labels.values()]).to.deep.equal([
      'ip_URI-0',
      'ip_URI-1#summary:1',
      'ip_URI-1#summary:0',
    ]);
  });

  it('qualifies only the traces their paths leave alike', () => {
    const labels = plotTabLabels(
      named(
        ['URI-0#magnetics:0/ip/0/measured', 'URI-0', 'measured_URI-0'],
        ['URI-0#magnetics:1/ip/0/measured', 'URI-0', 'measured_URI-0'],
        ['URI-0#magnetics/flux_loop/0/measured', 'URI-0', 'measured_URI-0'],
      ),
    );
    expect([...labels.values()]).to.deep.equal([
      'ip/0/measured_URI-0#magnetics:0',
      'ip/0/measured_URI-0#magnetics:1',
      'flux_loop/0/measured_URI-0',
    ]);
  });
});
