import fs from 'fs';
import os from 'os';
import path from 'path';
import { StartupRequest } from 'src/renderer/types';

export const EMPTY_STARTUP_REQUEST: StartupRequest = { configs: [], uris: [] };

const USAGE = `Usage: ibex [-h] [-v] [-c FILE [FILE ...] | -u URI [URI ...] [-n NAME] [-t TEMPLATE]]

IBEX (IMAS variaBles EXplorer): explore and plot IMAS data.

Options:
  -h, --help                show this help and exit
  -v, --version             print the IBEX version and exit
  -c, --config FILE...      load one or more IbexState files, one configuration each
  -u, --uri URI...          open a new configuration containing these data entries
  -n, --name NAME           with --uri: name of the new configuration
                            (default: config, config-1, config-2, ...)
  -t, --template TEMPLATE   with --uri and --name: apply a template, given as a file
                            path or as a name from the template folders; the URIs
                            fill the template's URI-0, URI-1, ... in order

--config and --uri cannot be used together: a state file already lists its URIs.
When --config or --uri is given, the default configuration is not loaded.

Examples:
  ibex -c runIbexState.json otherIbexState.json
  ibex -u "imas:hdf5?path=/path/to/entry1" "imas:hdf5?path=/path/to/entry2"
  ibex -u "imas:hdf5?path=/path/to/entry" -n kinetic -t PlotKineticProfiles`;

export type CliResult =
  | { action: 'help' }
  | { action: 'version' }
  | { action: 'error'; message: string }
  | { action: 'run'; request: StartupRequest };

type OptionName = 'help' | 'version' | 'config' | 'uri' | 'name' | 'template';

const SHORT_OPTIONS: Record<string, OptionName> = {
  '-h': 'help',
  '-v': 'version',
  '-c': 'config',
  '-u': 'uri',
  '-n': 'name',
  '-t': 'template',
};

const LONG_OPTIONS: OptionName[] = [
  'help',
  'version',
  'config',
  'uri',
  'name',
  'template',
];

const TEMPLATE_SUFFIXES = ['', '.json', 'IbexState.json'];

/**
 * Edit distance between two strings, counting a swap of two adjacent
 * characters as one edit.
 */
const editDistance = (a: string, b: string): number => {
  const d = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : i)),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
};

/**
 * The IBEX long option an unknown option name most likely meant to be
 * (--conf, --uris, --tempalte, ...), or undefined when it looks like a
 * Chromium/Electron switch instead.
 * @param name Option name, without leading dashes nor value
 */
export const closestOption = (name: string): OptionName | undefined => {
  const lowerName = name.toLowerCase();
  let closest: OptionName | undefined;
  let closestDistance = Infinity;
  for (const option of LONG_OPTIONS) {
    const distance = editDistance(lowerName, option);
    const isMatch =
      // Abbreviation, long enough not to catch Chromium's --v=1
      (lowerName.length >= 3 && option.startsWith(lowerName)) ||
      // Extra plural or suffix
      (lowerName.startsWith(option) && lowerName.length - option.length <= 2) ||
      distance <= (option.length <= 4 ? 1 : 2);
    if (isMatch && distance < closestDistance) {
      closest = option;
      closestDistance = distance;
    }
  }
  return closest;
};

/**
 * The --help text, ending with the templates installed with IBEX.
 * @param builtInTemplateDir The templates folder shipped with the app
 */
export const getHelpText = (builtInTemplateDir: string): string => {
  const templates = listTemplateNames([builtInTemplateDir]);
  const templateList = templates.length
    ? templates.map((name) => `  ${name}`).join('\n')
    : `  (none found in ${builtInTemplateDir})`;
  return `${USAGE}

Templates installed with IBEX (for --template):
${templateList}
Templates in the folders set in Preferences can also be given by name.`;
};

class CliError extends Error {}

const isFile = (filePath: string): boolean => {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
};

/**
 * Template folders the user added in Preferences (~/.ibexConfig), read
 * directly since the renderer is not running yet.
 */
export const readUserTemplateFolders = (): string[] => {
  try {
    const content = fs.readFileSync(
      path.join(os.homedir(), '.ibexConfig'),
      'utf-8',
    );
    const folders = JSON.parse(content)?.templateFolders;
    return Array.isArray(folders) ? folders : [];
  } catch {
    return [];
  }
};

const listTemplateNames = (templateDirs: string[]): string[] => {
  const names = new Set<string>();
  for (const dir of templateDirs) {
    try {
      for (const file of fs.readdirSync(dir)) {
        if (file.endsWith('.json')) {
          names.add(file.replace(/(IbexState)?\.json$/, ''));
        }
      }
    } catch {
      // Missing or unreadable folder: nothing to list
    }
  }
  return [...names].sort();
};

const resolveTemplate = (
  template: string,
  cwd: string,
  templateDirs: string[],
): string => {
  const asPath = path.resolve(cwd, template);
  if (isFile(asPath)) return asPath;

  if (!template.includes(path.sep)) {
    for (const dir of templateDirs) {
      for (const suffix of TEMPLATE_SUFFIXES) {
        const candidate = path.join(dir, template + suffix);
        if (isFile(candidate)) return candidate;
      }
    }
  }

  const available = listTemplateNames(templateDirs);
  throw new CliError(
    `template '${template}' not found` +
      (available.length ? ` (available: ${available.join(', ')})` : ''),
  );
};

/**
 * Parse the command-line arguments given to IBEX.
 *
 * Unknown long options are Chromium/Electron switches (e.g.
 * --remote-debugging-port=9222) and are ignored, except those that look like
 * a mistyped IBEX option (see closestOption), which are reported.
 *
 * @param args Arguments, without the executable (and app path in dev)
 * @param cwd Directory relative paths are resolved against
 * @param templateDirs Folders searched for a template given by name
 */
export const parseCliArgs = (
  args: string[],
  cwd: string,
  templateDirs: string[],
): CliResult => {
  if (args.some((arg) => arg === '-h' || arg === '--help')) {
    return { action: 'help' };
  }
  if (args.some((arg) => arg === '-v' || arg === '--version')) {
    return { action: 'version' };
  }

  const configs: string[] = [];
  const uris: string[] = [];
  let name: string | undefined;
  let template: string | undefined;

  try {
    let i = 0;
    while (i < args.length) {
      const arg = args[i];
      let option: OptionName | undefined;
      let inlineValue: string | undefined;

      if (arg.startsWith('--')) {
        const [optionName, ...rest] = arg.slice(2).split('=');
        option = LONG_OPTIONS.find((value) => value === optionName);
        inlineValue = rest.length ? rest.join('=') : undefined;
        if (!option) {
          const meant = closestOption(optionName);
          if (meant) {
            throw new CliError(
              `unknown option '--${optionName}' (did you mean '--${meant}'?)`,
            );
          }
          // Chromium/Electron switch, not ours
          i++;
          continue;
        }
      } else if (arg.startsWith('-')) {
        option = SHORT_OPTIONS[arg];
        if (!option) {
          const meant =
            arg.length > 2 ? closestOption(arg.slice(1)) : undefined;
          throw new CliError(
            `unknown option '${arg}'` +
              (meant ? ` (did you mean '--${meant}'?)` : ''),
          );
        }
      } else {
        throw new CliError(`unexpected argument '${arg}'`);
      }
      i++;

      // Values of the option: the inline one, or the following arguments
      // up to the next option
      const values = inlineValue !== undefined ? [inlineValue] : [];
      while (inlineValue === undefined && i < args.length) {
        if (args[i].startsWith('-')) break;
        values.push(args[i]);
        i++;
        if (option === 'name' || option === 'template') break;
      }
      if (!values.length || values.some((value) => !value)) {
        throw new CliError(`option '${arg}' requires a value`);
      }

      if (option === 'config') {
        configs.push(...values);
      } else if (option === 'uri') {
        uris.push(...values);
      } else if (option === 'name') {
        name = values[0];
      } else if (option === 'template') {
        template = values[0];
      }
    }

    if (configs.length && uris.length) {
      throw new CliError('--config and --uri cannot be used together');
    }
    if ((name !== undefined || template !== undefined) && !uris.length) {
      throw new CliError(
        `--${template !== undefined ? 'template' : 'name'} requires --uri`,
      );
    }
    if (template !== undefined && name === undefined) {
      throw new CliError('--template requires --name');
    }

    const request: StartupRequest = {
      configs: configs.map((config) => {
        const configPath = path.resolve(cwd, config);
        try {
          fs.accessSync(configPath, fs.constants.R_OK);
        } catch {
          throw new CliError(`cannot read state file '${config}'`);
        }
        if (!isFile(configPath)) {
          throw new CliError(`'${config}' is not a file`);
        }
        return configPath;
      }),
      uris,
    };
    if (name !== undefined) request.name = name;
    if (template !== undefined) {
      request.template = resolveTemplate(template, cwd, templateDirs);
    }

    return { action: 'run', request };
  } catch (error) {
    if (error instanceof CliError) {
      return { action: 'error', message: error.message };
    }
    throw error;
  }
};
