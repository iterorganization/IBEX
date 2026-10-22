import { expect } from 'chai';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { getHelpText, parseCliArgs } from './cli';

describe('parseCliArgs', () => {
  let cwd: string;
  let templateDir: string;

  before(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'ibex-cli-'));
    templateDir = path.join(cwd, 'templates');
    fs.mkdirSync(templateDir);
    fs.writeFileSync(path.join(cwd, 'a.json'), '{}');
    fs.writeFileSync(path.join(cwd, 'b.json'), '{}');
    fs.writeFileSync(
      path.join(templateDir, 'PlotScenarioIbexState.json'),
      '{}',
    );
  });

  after(() => fs.rmSync(cwd, { recursive: true, force: true }));

  const parse = (...args: string[]) => parseCliArgs(args, cwd, [templateDir]);
  const errorOf = (...args: string[]) => {
    const result = parse(...args);
    expect(result.action).to.equal('error');
    return result.action === 'error' ? result.message : '';
  };
  const requestOf = (...args: string[]) => {
    const result = parse(...args);
    expect(result.action, JSON.stringify(result)).to.equal('run');
    return result.action === 'run' ? result.request : undefined;
  };

  it('opens nothing without arguments', () => {
    expect(requestOf()).to.deep.equal({ configs: [], uris: [] });
  });

  it('ignores Chromium and Electron switches', () => {
    expect(
      requestOf(
        '--remote-debugging-port=9222',
        '--disable-gpu',
        '--no-watch',
        '--no-sandbox',
        '--v=1',
        '--user-data-dir=/x',
        '--lang=en',
        '--inspect',
        '--enable-logging',
        '--headless',
        '--test-type',
      ),
    ).to.deep.equal({ configs: [], uris: [] });
  });

  it('rejects mistyped long options with a hint', () => {
    const hints: [string[], string][] = [
      [['--conf', 'a.json'], 'config'],
      [['--configs', 'a.json'], 'config'],
      [['--Config=a.json'], 'config'],
      [['--uris', 'imas:a'], 'uri'],
      [['--url', 'imas:a'], 'uri'],
      [['-u', 'imas:a', '--names', 'n'], 'name'],
      [['-u', 'imas:a', '-n', 'n', '--tempalte', 'T'], 'template'],
      [['--hlep'], 'help'],
      [['--verison'], 'version'],
    ];
    for (const [args, option] of hints) {
      expect(errorOf(...args)).to.equal(
        `unknown option '${args.find((arg) => arg.startsWith('--'))?.split('=')[0]}' (did you mean '--${option}'?)`,
      );
    }
  });

  it('answers help and version before anything else', () => {
    expect(parse('-c', 'missing.json', '-h').action).to.equal('help');
    expect(parse('--help').action).to.equal('help');
    expect(parse('-u', 'imas:a', '-v').action).to.equal('version');
    expect(parse('--version').action).to.equal('version');
  });

  it('resolves several state files against the working directory', () => {
    expect(requestOf('-c', 'a.json', 'b.json').configs).to.deep.equal([
      path.join(cwd, 'a.json'),
      path.join(cwd, 'b.json'),
    ]);
    expect(requestOf('--config=a.json', '-c', 'b.json').configs).to.have.length(
      2,
    );
  });

  it('rejects a state file that cannot be read', () => {
    expect(errorOf('-c', 'missing.json')).to.contain('missing.json');
    expect(errorOf('-c', 'templates')).to.contain('not a file');
  });

  it('collects URIs from one or several --uri options', () => {
    expect(
      requestOf('-u', 'imas:a', 'imas:b', '--uri', 'imas:c').uris,
    ).to.deep.equal(['imas:a', 'imas:b', 'imas:c']);
  });

  it('takes a name and a template with --uri', () => {
    expect(
      requestOf('-u', 'imas:a', '-n', 'kin', '-t', 'PlotScenario'),
    ).to.deep.equal({
      configs: [],
      uris: ['imas:a'],
      name: 'kin',
      template: path.join(templateDir, 'PlotScenarioIbexState.json'),
    });
  });

  it('accepts a template given as a file path', () => {
    expect(
      requestOf('-u', 'imas:a', '-n', 'x', '-t', 'a.json').template,
    ).to.equal(path.join(cwd, 'a.json'));
  });

  it('lists the available templates when one is not found', () => {
    expect(errorOf('-u', 'imas:a', '-n', 'x', '-t', 'nope')).to.contain(
      'available: PlotScenario',
    );
  });

  it('enforces the combination rules', () => {
    expect(errorOf('-c', 'a.json', '-u', 'imas:a')).to.contain(
      'cannot be used together',
    );
    expect(errorOf('-n', 'kin')).to.equal('--name requires --uri');
    expect(errorOf('-t', 'PlotScenario', '-n', 'x')).to.equal(
      '--template requires --uri',
    );
    expect(errorOf('-u', 'imas:a', '-t', 'PlotScenario')).to.equal(
      '--template requires --name',
    );
  });

  it('rejects missing values, stray arguments and unknown short options', () => {
    expect(errorOf('-c')).to.contain('requires a value');
    expect(errorOf('-u', '-n', 'x')).to.contain('requires a value');
    expect(errorOf('--config=')).to.contain('requires a value');
    expect(errorOf('a.json')).to.contain("unexpected argument 'a.json'");
    expect(errorOf('-u', 'imas:a', '-n', 'my', 'name')).to.contain(
      "unexpected argument 'name'",
    );
    expect(errorOf('-x')).to.equal("unknown option '-x'");
    expect(errorOf('-config', 'a.json')).to.equal(
      "unknown option '-config' (did you mean '--config'?)",
    );
  });
});

describe('getHelpText', () => {
  let templateDir: string;

  before(() => {
    templateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ibex-templates-'));
    fs.writeFileSync(
      path.join(templateDir, 'PlotScenarioIbexState.json'),
      '{}',
    );
    fs.writeFileSync(path.join(templateDir, 'Other.json'), '{}');
    fs.writeFileSync(path.join(templateDir, 'notes.txt'), '');
  });

  after(() => fs.rmSync(templateDir, { recursive: true, force: true }));

  it('lists the installed templates by the name --template takes', () => {
    expect(getHelpText(templateDir)).to.contain('  Other\n  PlotScenario\n');
  });

  it('says so when no template is installed', () => {
    expect(getHelpText(path.join(templateDir, 'missing'))).to.contain(
      '(none found in',
    );
  });
});
