import { StateCreator } from 'zustand';
import {
  Configuration,
  ConfigurationState,
  Coordinates,
  DataGridPlot,
  ibexState,
} from 'src/renderer/types';
import { pruneUiState } from './uiSlice';
import {
  clampCursors,
  getLastIndexedField,
  updateIndexFieldName,
} from '../utils';
import { baseOf } from './payloadRegistry';

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
  setCursor: (gridId, coordinateName, valueIndex) => {
    set((state) => {
      const active = state.active;
      const grid = active?.dataPlot?.find((item) => item.i === gridId);
      const coordinate = grid?.coordinates?.find(
        (coord) => coord.name === coordinateName,
      );
      if (!coordinate) return state;
      if (coordinate.valueIndex === valueIndex) return state;

      // The index that has to be rewritten into every path and target of the
      // grids that move.
      const indexedField = getLastIndexedField(coordinate.target);
      if (!indexedField) {
        console.warn('No indexed field found in target');
        return state;
      }

      // A synchronized grid follows only where it is showing the same data.
      // That used to be decided by walking both coordinates element by element
      // on every tick; the payload's key answers it with a string compare, and
      // it answers it correctly - two grids can hold equal numbers from
      // different nodes.
      const sameData = (other: DataGridPlot) => {
        const theirs = other.coordinates?.find(
          (coord) => coord.name === coordinateName,
        );
        if (!theirs?.dataRef || !coordinate.dataRef) return false;
        return baseOf(theirs.dataRef) === baseOf(coordinate.dataRef);
      };

      const follows = (item: DataGridPlot) =>
        item.i === gridId ||
        (grid.synchronizedGrids?.list.includes(item.i) && sameData(item));

      const moved = (item: DataGridPlot): DataGridPlot => {
        const coordinates = item.coordinates.map(
          (coord): Coordinates => ({
            ...coord,
            path: updateIndexFieldName(coord.path, indexedField, valueIndex),
            target: updateIndexFieldName(
              coord.target,
              indexedField,
              valueIndex,
            ),
            valueIndex:
              coord.name === coordinateName ? valueIndex : coord.valueIndex,
          }),
        );
        clampCursors(coordinates);

        return {
          ...item,
          coordinates,
          // Only the labels move. What is drawn is derived from the payload and
          // these integers, so a tick writes no array at all - which is what
          // makes its cost independent of how big the payload is.
          plot: item.plot.map((plotItem) => ({
            ...plotItem,
            nodeUri: updateIndexFieldName(
              plotItem.nodeUri,
              indexedField,
              valueIndex,
            ),
            path: updateIndexFieldName(
              plotItem.path || '',
              indexedField,
              valueIndex,
            ),
          })),
          xAxisData: {
            ...item.xAxisData,
            path: updateIndexFieldName(
              item.xAxisData?.path || '',
              indexedField,
              valueIndex,
            ),
          },
        };
      };

      const configuration: Configuration = {
        ...active,
        saved: false,
        dataPlot: active.dataPlot.map((item) =>
          follows(item) ? moved(item) : item,
        ),
      };

      return {
        ...state,
        active: configuration,
        configurations: state.configurations.map((entry) =>
          entry.name === configuration.name ? configuration : entry,
        ),
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
