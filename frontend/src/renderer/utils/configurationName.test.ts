import { expect } from 'chai';
import {
  configurationNameError,
  uniqueConfigurationName,
} from './configurationName';

describe('configurationNameError', () => {
  it('accepts a new name', () => {
    expect(configurationNameError('kin', ['config'])).to.equal(null);
  });

  it('rejects an empty or blank name', () => {
    expect(configurationNameError('', [])).to.equal('This field is required');
    expect(configurationNameError('  ', [])).to.equal('This field is required');
  });

  it('rejects a name already taken', () => {
    expect(configurationNameError('config', ['config'])).to.equal(
      'This name is already taken',
    );
  });
});

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
