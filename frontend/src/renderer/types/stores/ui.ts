/**
 * Transient state: what the session is doing, as opposed to what the
 * configuration *is*. None of it is written to `<name>IbexState.json`.
 */
export interface UiState {
  /**
   * The grid being edited, or `null`.
   *
   * This was a `isEditing` boolean on every grid, but only ever one at a time:
   * `handleEditGrid` cleared the flag on every other grid on its way through.
   * Expressing the singleton as a singleton makes entering edit mode an O(1)
   * write that leaves every grid object untouched, instead of rebuilding the
   * ones whose flag had to be cleared.
   */
  editingGridId: string | null;

  setEditingGrid?: (id: string | null) => void;
}
