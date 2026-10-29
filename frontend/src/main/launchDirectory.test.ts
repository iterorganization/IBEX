import { expect } from 'chai';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { listLaunchDirectory } from './launchDirectory';

describe('listLaunchDirectory', () => {
  let dir: string;

  before(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ibex-launch-dir-'));
    fs.writeFileSync(path.join(dir, 'b.json'), '{}');
    fs.writeFileSync(path.join(dir, 'aIbexState.json'), '{}');
    fs.writeFileSync(path.join(dir, 'notes.txt'), '');
    fs.writeFileSync(path.join(dir, 'run.nc'), '');
    fs.writeFileSync(path.join(dir, 'master.h5'), '');
    fs.mkdirSync(path.join(dir, 'folder.json'));
    fs.mkdirSync(path.join(dir, 'entry'));
    fs.writeFileSync(path.join(dir, 'entry', 'master.h5'), '');
    fs.mkdirSync(path.join(dir, 'empty'));
    fs.mkdirSync(path.join(dir, 'deep', 'entry'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'deep', 'entry', 'master.h5'), '');
    fs.symlinkSync(path.join(dir, 'entry'), path.join(dir, 'linked'));
    fs.symlinkSync(path.join(dir, 'missing'), path.join(dir, 'broken.json'));
  });

  after(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('lists the .json files, sorted, without directories', async () => {
    expect(await listLaunchDirectory(dir, 'configs')).to.deep.equal({
      dir,
      entries: [
        { label: 'aIbexState.json', path: path.join(dir, 'aIbexState.json') },
        { label: 'b.json', path: path.join(dir, 'b.json') },
      ],
    });
  });

  it('lists HDF5 entries one level down and netCDF files', async () => {
    expect(await listLaunchDirectory(dir, 'dataEntries')).to.deep.equal({
      dir,
      entries: [
        { label: './', path: path.join(dir, 'master.h5') },
        { label: 'entry/', path: path.join(dir, 'entry', 'master.h5') },
        { label: 'linked/', path: path.join(dir, 'linked', 'master.h5') },
        { label: 'run.nc', path: path.join(dir, 'run.nc') },
      ],
    });
  });

  it('rejects a directory that does not exist', async () => {
    let error: unknown;
    await listLaunchDirectory(path.join(dir, 'missing'), 'configs').catch(
      (caught) => (error = caught),
    );
    expect(error).to.be.instanceOf(Error);
  });
});
