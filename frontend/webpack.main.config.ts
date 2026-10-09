import type { Configuration } from 'webpack';
import { rules } from './webpack.rules';
import { config } from 'dotenv';
import { DefinePlugin } from 'webpack';
import { execFileSync } from 'child_process';
import { version as packageVersion } from './package.json';

config();

// Version printed by `ibex --version`: last tag, commits since, hash (e.g.
// 0.3.0-47-g2c7fd0c), or the package.json version outside a git checkout
const getIbexVersion = (): string => {
  try {
    return execFileSync('git', ['describe', '--tags', '--long', '--dirty'], {
      cwd: __dirname,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return packageVersion;
  }
};

export const mainConfig: Configuration = {
  entry: './src/main',
  module: {
    rules,
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
    fallback: {
      path: false,
    },
  },
  plugins: [
    new DefinePlugin({
      'process.env.E2E_TEST': JSON.stringify(process.env.E2E_TEST || 'false'),
      IBEX_VERSION: JSON.stringify(getIbexVersion()),
    }),
  ],
  watch: false,
};
