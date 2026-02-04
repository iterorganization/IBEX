import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { WebpackPlugin } from '@electron-forge/plugin-webpack';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import { getConfigSync } from './src/config';
import { mainConfig } from './webpack.main.config';
import { rendererConfig } from './webpack.renderer.config';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const configVaribles = getConfigSync();

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    extraResource: [
      path.resolve(__dirname, '..', 'templates'),
      path.resolve(__dirname, '..', 'backend'),
    ],
  },
  rebuildConfig: {},
  makers: [
    // new MakerSquirrel({}),  // Windows only
    // new MakerZIP({}, ['darwin']),  // macOS only
    new MakerRpm({}),  // RedHat/Fedora/CentOS
    // Uncomment for Debian/Ubuntu if dpkg and fakeroot are installed:
    // new MakerDeb({}),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new WebpackPlugin({
      mainConfig,
      port: configVaribles.WEBPACK_PORT,
      loggerPort: configVaribles.LOGGER_PORT,
      renderer: {
        config: rendererConfig,
        entryPoints: [
          {
            html: './src/renderer/index.html',
            // This is the entry point for the renderer process search default file is index.ts or index.tsx
            js: './src/renderer',
            name: 'main_window',
            preload: {
              js: './src/preload.ts',
            },
          },
        ],
      },
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
  hooks: {
    postPackage: async (config: any, options: any) => {
      const backendBinarySource = path.resolve(__dirname, '..', 'dist', 'run_ibex_service');
      const outputPath = options.outputPaths[0];
      const backendDistDest = path.join(outputPath, 'resources', 'backend', 'dist');
      const backendBinaryDest = path.join(backendDistDest, 'run_ibex_service');

      if (fs.existsSync(backendBinarySource)) {
        try {
          fs.mkdirSync(backendDistDest, { recursive: true });
          fs.copyFileSync(backendBinarySource, backendBinaryDest);
          fs.chmodSync(backendBinaryDest, 0o755);
        } catch (error) {
          console.error(`[postPackage] ✗ Failed to copy backend binary: ${error}`);
        }
      } else {
        console.warn(`[postPackage] ⚠ Warning: backend binary not found at ${backendBinarySource}`);
      }
    },
    preMake: async () => {
      const outDir = path.resolve(__dirname, 'out');
      const backendLicense = path.resolve(__dirname, '..', 'backend', 'LICENSE.txt');

      if (!fs.existsSync(outDir) || !fs.existsSync(backendLicense)) {
        return;
      }

      const candidates = fs
        .readdirSync(outDir)
        .map((name) => path.join(outDir, name, 'resources', 'backend'))
        .filter((p) => fs.existsSync(p));

      for (const backendDir of candidates) {
        const licenseDest = path.join(backendDir, 'LICENSE.txt');
        if (!fs.existsSync(licenseDest)) {
          fs.copyFileSync(backendLicense, licenseDest);
        }
      }
    },
  },
};

export default config;
