import { Configuration } from '..';
import { TestState } from './testState';

export interface ConfigurationState {
  configurations: Configuration[];
  active: Configuration | null;

  addConfiguration?: (configuration: Configuration) => void;
  updatedConfiguration?: (configuration: Configuration) => void;
  removeConfiguration?: (name: string) => void;
  setActive?: (name: string) => void;
  /** Move one coordinate's cursor; see `stores/configurationSlice.ts`. */
  setCursor?: (
    gridId: string,
    coordinateName: string,
    valueIndex: number,
  ) => void;
  /** The E2E bridge's way in; see `renderer/utils/testState.ts`. */
  setState?: (state: Partial<TestState>) => void;
  getState?: () => ConfigurationState;
}
