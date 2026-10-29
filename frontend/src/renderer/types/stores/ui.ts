import { CustomizedGrid } from '..';

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

  /** The grid whose metadata panel is open, or `null`. */
  metadataGridId: string | null;

  /** The grid whose customization panel is open, and which half of it. */
  customizing: CustomizedGrid | null;

  /**
   * What the node tree shows, per configuration name: which data entries are
   * open and which nodes of each are expanded.
   *
   * It lived in each `TreeLibrary`'s `useTree`, so collapsing the side panel or
   * switching configuration forgot it, and reloading a data entry left nodes
   * marked open over children that were gone. Only the user collapses a node;
   * the code only ever adds to this.
   */
  treeView: Record<string, TreeViewState>;

  setEditingGrid?: (id: string | null) => void;
  setMetadataGrid?: (id: string | null) => void;
  setCustomizing?: (customizing: CustomizedGrid | null) => void;
  setTreeNodeExpanded?: (
    configuration: string,
    uri: string,
    nodeValue: string,
    expanded: boolean,
  ) => void;
  /** Expands `nodeValues` and opens `uri`, never collapsing anything. */
  revealTreeNodes?: (
    configuration: string,
    uri: string,
    nodeValues: string[],
  ) => void;
  setOpenUris?: (configuration: string, uris: string[]) => void;
}

export interface TreeViewState {
  /** The data entries whose accordion item is open. */
  openUris: string[];
  /** The expanded node values, per data entry URI. */
  expanded: Record<string, string[]>;
}
