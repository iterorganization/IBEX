import { API } from '../preload';

// This allows typescript to understand that the global 'window' contains the 'api'
declare global {
  interface Window {
    api: typeof API;
    env: {
      E2E_TEST: string;
    };
  }
}
