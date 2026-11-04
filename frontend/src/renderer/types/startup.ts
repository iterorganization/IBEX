/**
 * What the user asked to open when starting IBEX: from the command line in
 * the desktop app (see src/main/cli.ts), and later from a web deep link.
 */
export type StartupRequest = {
  // IbexState files to load, one configuration each
  configs: string[];
  // Data entry URIs to open together in a new configuration
  uris: string[];
  // Template file applied to the new configuration built from `uris`
  template?: string;
  // Name of the new configuration built from `uris`
  name?: string;
};
