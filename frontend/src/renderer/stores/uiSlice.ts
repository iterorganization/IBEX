import { StateCreator } from 'zustand';
import { UiState } from 'src/renderer/types';

export const uiSlice: StateCreator<UiState> = (set) => ({
  editingGridId: null,

  setEditingGrid: (id) =>
    set((state) =>
      state.editingGridId === id ? state : { ...state, editingGridId: id },
    ),
});
