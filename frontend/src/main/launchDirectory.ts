import fs from 'fs/promises';
import path from 'path';
import {
  LaunchDirectoryKind,
  LaunchDirectoryListing,
} from '../renderer/types/launchDirectory';

// File of an HDF5 data entry that /data_entry/uri_from_path recognises
const HDF5_MASTER_FILE = 'master.h5';

const byLabel = (
  a: LaunchDirectoryListing['entries'][number],
  b: LaunchDirectoryListing['entries'][number],
) => a.label.localeCompare(b.label);

const isFile = (filePath: string) =>
  fs
    .stat(filePath)
    .then((stats) => stats.isFile())
    .catch(() => false);

/**
 * List what can be opened from `dir`: its `.json` files for `configs`; for
 * `dataEntries`, its netCDF files and the HDF5 data entries in it or in one of
 * its subdirectories (deeper ones are left to the file dialog, to keep this
 * fast on large directories).
 */
export const listLaunchDirectory = async (
  dir: string,
  kind: LaunchDirectoryKind,
): Promise<LaunchDirectoryListing> => {
  const dirents = await fs.readdir(dir, { withFileTypes: true });
  // Symbolic links count as what they point to
  const resolved = await Promise.all(
    dirents.map(async (dirent) => {
      const fullPath = path.join(dir, dirent.name);
      const stats = dirent.isSymbolicLink()
        ? await fs.stat(fullPath).catch((): null => null)
        : dirent;
      return {
        name: dirent.name,
        fullPath,
        isFile: stats?.isFile() ?? false,
        isDirectory: stats?.isDirectory() ?? false,
      };
    }),
  );

  if (kind === 'configs') {
    const entries = resolved
      .filter((entry) => entry.isFile && entry.name.endsWith('.json'))
      .map((entry) => ({ label: entry.name, path: entry.fullPath }));
    return { dir, entries: entries.sort(byLabel) };
  }

  const netcdf = resolved
    .filter((entry) => entry.isFile && entry.name.endsWith('.nc'))
    .map((entry) => ({ label: entry.name, path: entry.fullPath }));

  const hdf5Candidates = [
    { label: './', dirPath: dir },
    ...resolved
      .filter((entry) => entry.isDirectory && !entry.name.startsWith('.'))
      .map((entry) => ({ label: `${entry.name}/`, dirPath: entry.fullPath })),
  ];
  const hdf5 = (
    await Promise.all(
      hdf5Candidates.map(async ({ label, dirPath }) => {
        const master = path.join(dirPath, HDF5_MASTER_FILE);
        return (await isFile(master)) ? { label, path: master } : null;
      }),
    )
  ).filter((entry) => entry !== null);

  return { dir, entries: [...hdf5, ...netcdf].sort(byLabel) };
};
