import { create } from 'zustand';
import { ibexState } from 'src/renderer/types';
import { configurationSlice, uiSlice } from '.';

export const useIbexStore = create<ibexState>()((...a) => ({
  ...configurationSlice(...a),
  ...uiSlice(...a),
}));
