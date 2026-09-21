import { StateCreator } from 'zustand';
import { Configuration, ibexState, UiState } from 'src/renderer/types';

/**
 * Drops the ui ids that no longer name a grid of the active configuration.
 *
 * These ids used to live on the configuration itself, so switching or clearing
 * it took them with it. Now that they are session state they outlive it, and a
 * stale `customizing` is not harmless: `TreeLibrary.handleDisableTree` disables
 * the whole node tree whenever a panel is open, so an id left behind by a
 * configuration that is gone leaves the tree dead with no panel on screen to
 * explain why.
 */
export const pruneUiState = (
  ui: UiState,
  active: Configuration | null,
): Pick<UiState, 'editingGridId' | 'metadataGridId' | 'customizing'> => {
  const resolves = (id?: string | null) =>
    Boolean(id) && Boolean(active?.dataPlot?.some((grid) => grid.i === id));

  return {
    editingGridId: resolves(ui.editingGridId) ? ui.editingGridId : null,
    metadataGridId: resolves(ui.metadataGridId) ? ui.metadataGridId : null,
    customizing: resolves(ui.customizing?.id) ? ui.customizing : null,
  };
};

export const uiSlice: StateCreator<ibexState, [], [], UiState> = (set) => ({
  editingGridId: null,
  metadataGridId: null,
  customizing: null,

  setEditingGrid: (id) =>
    set((state) =>
      state.editingGridId === id ? state : { ...state, editingGridId: id },
    ),

  setMetadataGrid: (id) =>
    set((state) =>
      state.metadataGridId === id ? state : { ...state, metadataGridId: id },
    ),

  setCustomizing: (customizing) => set((state) => ({ ...state, customizing })),
});
