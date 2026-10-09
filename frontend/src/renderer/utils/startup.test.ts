import { expect } from 'chai';
import { DataGridPlotToSave } from '../types';
import {
  missingTemplateLabels,
  startupDataURI,
  uniqueConfigurationName,
} from './startup';

describe('uniqueConfigurationName', () => {
  it('keeps a free name', () => {
    expect(uniqueConfigurationName('config', ['other'])).to.equal('config');
  });

  it('adds the first free numbered suffix', () => {
    expect(uniqueConfigurationName('config', ['config'])).to.equal('config-1');
    expect(
      uniqueConfigurationName('config', ['config', 'config-1', 'config-3']),
    ).to.equal('config-2');
  });
});

describe('startupDataURI', () => {
  it('names entries by position and leaves out the missing ones', () => {
    expect(
      startupDataURI(
        ['imas:a', 'imas:b', 'imas:c'],
        [true, false, true],
        () => '#000',
      ),
    ).to.deep.equal([
      { name: 'URI-0', uri: 'imas:a', uriColor: '#000' },
      { name: 'URI-2', uri: 'imas:c', uriColor: '#000' },
    ]);
  });
});

describe('missingTemplateLabels', () => {
  const grid = (...labels: string[]) =>
    ({
      plot: labels.map((labelUri) => ({ labelUri })),
    }) as DataGridPlotToSave;

  it('lists the labels no data entry provides', () => {
    expect(
      missingTemplateLabels(
        [grid('URI-0', 'URI-2'), grid('URI-1', 'URI-0')],
        [{ name: 'URI-0', uri: 'imas:a' }],
      ),
    ).to.deep.equal(['URI-1', 'URI-2']);
  });

  it('finds nothing missing without a template', () => {
    expect(missingTemplateLabels([], [])).to.deep.equal([]);
  });
});
