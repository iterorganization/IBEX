import { StateCreator } from 'zustand';
import { ConfigurationState, ibexState } from 'src/renderer/types';
import { pruneUiState } from './uiSlice';

// Typed against the whole store, not just its own slice: `pruneUiState` below
// reads and writes the ui fields, because the invariant it enforces spans both.
export const configurationSlice: StateCreator<
  ibexState,
  [],
  [],
  ConfigurationState
> = (set, get) => ({
  configurations: [],
  active: null,

  addConfiguration: (configuration) =>
    set((state) => ({
      configurations: [...state.configurations, configuration],
    })),

  updatedConfiguration: (configuration) => {
    set((state) => {
      const updatedConfigurations = state.configurations.map((c) =>
        c.name === configuration.name ? configuration : c,
      );

      const updatedActive =
        state.active?.name === configuration.name
          ? configuration
          : state.active;

      return {
        ...state,
        active: updatedActive,
        configurations: updatedConfigurations,
      };
    });
  },

  removeConfiguration: (name) => {
    set((state) => {
      const configuration = state.configurations.find((c) => c.name === name);
      if (!configuration) return state;

      const updatedConfigurations = state.configurations.filter(
        (c) => c.name !== name,
      );

      const updateActive =
        state.active?.name === configuration.name
          ? updatedConfigurations[updatedConfigurations.length - 1]
          : state.active;

      return {
        configurations: updatedConfigurations,
        active: updateActive,
        ...pruneUiState(state, updateActive),
      };
    });
  },

  setActive: (name) => {
    set((state) => {
      const configuration = state.configurations.find((c) => c.name === name);
      if (!configuration) return state;

      return {
        ...state,
        active: configuration,
        ...pruneUiState(state, configuration),
      };
    });
  },
  setState: (newState) => {
    set((state) => {
      const merged = { ...state, ...newState };
      // The e2e bridge can replace the active configuration wholesale, so the
      // same invariant applies here.
      return { ...merged, ...pruneUiState(merged, merged.active) };
    });
  },

  getState: () => {
    return get();
  },
});
