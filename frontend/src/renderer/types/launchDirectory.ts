/**
 * Files found in the directory IBEX was started from, offered as one-click
 * shortcuts by the Load menu and the Select URIs modal.
 */
export type LaunchDirectoryKind = 'configs' | 'dataEntries';

export type LaunchDirectoryListing = {
  // Absolute path of the directory IBEX was started from
  dir: string;
  // `path` is what to open: a configuration file, or a data file the backend
  // turns into a URI (/data_entry/uri_from_path); `label` is what to show
  entries: { label: string; path: string }[];
};
