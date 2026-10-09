import { app } from 'electron';
import path from 'path';

/**
 * Path of a folder shipped next to the app: the repository root in
 * development, the packaged resources/ folder in production.
 */
export const getResourcesPath = (...folderSteps: string[]): string =>
  process.env.NODE_ENV === 'development'
    ? path.join(app.getAppPath(), '..', ...folderSteps) // root in dev
    : path.join(process.resourcesPath, ...folderSteps); // resources/ in prod
