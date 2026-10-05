import { CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { TreeLibrariesAccordion } from '../../components';
import { useIbexStore } from '../../stores';
import {
  Configuration,
  CustomTreeData,
  CustomTreeNodeData,
  NodeInfoResponse,
  NodeInfoChildrenResponse,
  NodeInfoTypeEnum,
  SearchNodeResponse,
  URIData,
  URITreeNodeData,
} from '../../types';
import {
  ActionIcon,
  Avatar,
  Container,
  Fieldset,
  Group,
  Loader,
  ScrollArea,
  Switch,
  TextInput,
  Transition,
} from '@mantine/core';
import { IconChevronRight, IconSearch } from '@tabler/icons-react';
import { useForm } from '@mantine/form';
import { showNotification } from '@mantine/notifications';
import {
  buildTree,
  fetchDataIds,
  fetchFindPaths,
  fetchNodeInfos,
  findTreeNode,
  handleExistingPlot,
  handleNewPlot,
  mapTreeNode,
} from '../../utils';

interface VisualizationTreeProps {
  extended?: boolean;
  handleExtended?: () => void;
}

const FILL_COLUMN: CSSProperties = { display: 'flex', flexDirection: 'column' };
/** Takes the height left in a column; `minHeight: 0` lets it shrink below its content, which then scrolls. */
const GROW: CSSProperties = { flex: 1, minHeight: 0 };
const FILL_REST: CSSProperties = { ...FILL_COLUMN, ...GROW };

interface FormSearchNode {
  node: string;
}

const NO_OPEN_URIS: string[] = [];

export const VisualizationTree = ({
  extended,
  handleExtended,
}: VisualizationTreeProps) => {
  const { active } = useIbexStore();
  const editingGridId = useIbexStore((state) => state.editingGridId);
  const openUris =
    useIbexStore((state) => state.treeView[state.active?.name]?.openUris) ??
    NO_OPEN_URIS;

  /**
   * Writes a node tree onto the active configuration as it is *now*.
   *
   * Every tree update awaits the backend, and what happens meanwhile - a node
   * checked and plotted, a panel edited - is newer than the configuration the
   * update started from. Writing `{ ...thatConfiguration, customDataTree }`
   * back undid it: the plot vanished and the node was unchecked, so the next
   * click on it plotted it again instead of removing it. Only the tree is
   * this update's to write.
   */
  const writeCustomDataTree = (
    from: Configuration,
    customDataTree: CustomTreeData[],
  ) => {
    const { active: latest, updatedConfiguration } = useIbexStore.getState();
    if (!latest || latest.name !== from.name) return;
    updatedConfiguration({ ...latest, customDataTree });
  };

  /** The data entry opened last: the one a search not over all of them reads. */
  const [uriSelected, setUriSelected] = useState<URIData | null>();
  const [showErrorBars, setShowErrorBars] = useState<boolean>(false);
  const [searchNodeIsLoading, setSearchNodeIsLoading] =
    useState<boolean>(false);
  const [searchAllUris, setSearchAllUris] = useState<boolean>(false);
  /** A search's results per data entry, or `null` when not searching. */
  const [searchResults, setSearchResults] = useState<Record<
    string,
    CustomTreeNodeData[]
  > | null>(null);
  /** The checked nodes when the search started, to tell those it added. */
  const checkedBeforeSearch = useRef<URITreeNodeData[] | null>(null);

  const formSearchNode = useForm<FormSearchNode>({
    initialValues: {
      node: '',
    },

    onValuesChange: (values) => {
      if (values.node === '') clearSearch();
    },
    validate: (values) => {
      if (values.node.length < 2) {
        return { node: 'Node name must have at least 2 characters' };
      }
    },
  });

  /**
   * Builds tree nodes for the children a node info lists.
   * @param nodeInfoschildren
   * @param nodeUri the parent's node value
   * @param uriLabel the name of the data entry the tree browses
   */
  const fetchChildrenNodeInfos = (
    nodeInfoschildren: NodeInfoChildrenResponse[],
    nodeUri: string,
    uriLabel: string,
    seeErrorBars: boolean,
  ): CustomTreeNodeData[] =>
    nodeInfoschildren.map((child: NodeInfoChildrenResponse) => {
      const newValue =
        child.type === NodeInfoTypeEnum.ARRAY
          ? `${nodeUri}${child.name}[:]/`
          : child.type === NodeInfoTypeEnum.STRUCTURE
            ? `${nodeUri}${child.name}/`
            : `${nodeUri}${child.name}`;
      return {
        label: child.name,
        value: newValue,
        seeErrorBars,
        type: child.type,
        children: [] as CustomTreeNodeData[],
        uriLabel,
        is_geometry_node: child.is_geometry_node,
      };
    });

  /**
   * Loads the children of a node, unless they are loaded already.
   *
   * The children are fetched first and then written onto the tree as it is
   * once they arrive, so two folders opened at the same time - in one data
   * entry or two - both keep what they loaded.
   *
   * @returns whether the node has children
   */
  async function fetchNodeTree(
    nodeUri: string,
    seeErrorBars: boolean,
  ): Promise<boolean> {
    if (!nodeUri) return false;

    const { active } = useIbexStore.getState();
    const dataTree = active?.customDataTree.find(
      (tree) => tree.uri && nodeUri.startsWith(tree.uri + '#'),
    );
    const node = dataTree && findTreeNode(dataTree.data, nodeUri);
    if (!node) return false;
    if (node.children?.length > 0 && node.seeErrorBars === seeErrorBars) {
      return true;
    }

    try {
      /**
       * Replace [:] and remove the last /
       */
      const nodeInfos: NodeInfoResponse = await fetchNodeInfos(
        nodeUri.replace(/\[:\]/, '').slice(0, -1),
        seeErrorBars,
      );
      const children = fetchChildrenNodeInfos(
        nodeInfos.children || [],
        nodeUri,
        dataTree.name,
        seeErrorBars,
      );

      const { active: latest } = useIbexStore.getState();
      if (!latest || latest.name !== active.name) return false;
      writeCustomDataTree(
        latest,
        latest.customDataTree.map((tree) =>
          tree.uri !== dataTree.uri
            ? tree
            : {
                ...tree,
                data: mapTreeNode(tree.data, nodeUri, (current) => ({
                  ...current,
                  seeErrorBars,
                  // Keep what was loaded under the children already there.
                  children: children.map((child) => {
                    const old = (
                      current.children as CustomTreeNodeData[]
                    )?.find((c) => c.value === child.value);
                    return old ? { ...child, children: old.children } : child;
                  }),
                })),
              },
        ),
      );
      return children.length > 0;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  /** The root lists being fetched, so a data entry is listed only once. */
  const pendingIDSData = useRef(new Map<string, Promise<void>>());

  /**
   * Lists the IDSs of a data entry, unless its tree is loaded already.
   *
   * It used to list them again each time the entry was opened, replacing the
   * whole tree with roots without children - while the nodes stayed marked
   * expanded, so they showed open folders over nothing.
   */
  const fetchIDSData = (dataUri: URIData): Promise<void> => {
    const loaded = useIbexStore
      .getState()
      .active?.customDataTree.find((item) => item.uri === dataUri.uri);
    if (!loaded || loaded.data.length > 0) return Promise.resolve();

    const pending = pendingIDSData.current.get(dataUri.uri);
    if (pending) return pending;

    const load = (async () => {
      try {
        const listIdsResult = await fetchDataIds(dataUri.uri);
        const newTree: CustomTreeNodeData[] = [];

        for (const ids of listIdsResult.idses) {
          for (const oc of ids.occurrences) {
            newTree.push({
              label: `${ids.name}:${oc}`,
              value: `${dataUri.uri}#${ids.name}:${oc}/`,
              type: NodeInfoTypeEnum.STRUCTURE,
              children: [],
              seeErrorBars: showErrorBars,
              uriLabel: dataUri.name,
              is_geometry_node: false,
            });
          }
        }

        // The tree of the configuration as it is now, not as it was when
        // this render closed over it: another data entry's tree may have
        // loaded while this one was being listed.
        const { active: latest } = useIbexStore.getState();
        if (!latest) return;
        writeCustomDataTree(
          latest,
          latest.customDataTree.map((item) =>
            item.uri === dataUri.uri && item.data.length === 0
              ? { ...item, data: newTree }
              : item,
          ),
        );
      } catch (error) {
        console.error(error);
      } finally {
        pendingIDSData.current.delete(dataUri.uri);
      }
    })();
    pendingIDSData.current.set(dataUri.uri, load);
    return load;
  };

  // Whatever opened a data entry - a click, a search, an edited plot, a
  // configuration switched back to - its roots must be there.
  useEffect(() => {
    for (const uri of openUris) {
      const dataUri = active?.dataURI.find((item) => item.uri === uri);
      if (dataUri) fetchIDSData(dataUri);
    }
  }, [openUris, active?.name]);

  /**
   * Opens the folders down to each node, loading them on the way, in the data
   * entry each one belongs to. Nothing is ever collapsed.
   * @param nodeUris full node URIs, `<uri>#<ids>:<occurrence>/<path>`
   */
  const revealNodes = async (nodeUris: string[]) => {
    const { active, revealTreeNodes } = useIbexStore.getState();
    if (!active) return;

    // Folder chain of every node, parents first, per data entry.
    const foldersByUri = new Map<string, string[]>();
    for (const nodeUri of nodeUris) {
      const [uri, path] = nodeUri.split('#');
      if (!uri || !path) continue;
      const segments = path.replace(/\[\d+\]/g, '[:]').split(/(?<=\/)/);
      segments.pop();
      const folders = foldersByUri.get(uri) ?? [];
      let value = uri + '#';
      for (const segment of segments) {
        value += segment;
        if (!folders.includes(value)) folders.push(value);
      }
      foldersByUri.set(uri, folders);
    }

    await Promise.all(
      [...foldersByUri].map(async ([uri, folders]) => {
        const dataUri = active.dataURI.find((item) => item.uri === uri);
        if (!dataUri) return;
        await fetchIDSData(dataUri);
        const opened: string[] = [];
        for (const folder of folders) {
          if (await fetchNodeTree(folder, showErrorBars)) opened.push(folder);
        }
        revealTreeNodes(active.name, uri, opened);
      }),
    );
  };

  // Editing a plot shows every signal it uses, whichever data entry it is in.
  useEffect(() => {
    if (!editingGridId) return;
    const grid = useIbexStore
      .getState()
      .active?.dataPlot.find((plot) => plot.i === editingGridId);
    if (!grid?.plot.length) return;
    revealNodes(grid.plot.map((plot) => plot.nodeUri));
  }, [editingGridId]);

  /**
   * Handle accordion change
   * @param values the data entries now open
   */
  function handleAccordionChange(values: string[]) {
    if (!active) return;
    const opened = values.find((uri) => !openUris.includes(uri));
    useIbexStore.getState().setOpenUris(active.name, values);

    if (opened) {
      setUriSelected(active.dataURI.find((item) => item.uri === opened));
    } else if (!values.includes(uriSelected?.uri)) {
      const last = values[values.length - 1];
      setUriSelected(active.dataURI.find((item) => item.uri === last) ?? null);
    }
  }

  /**
   * Fetch children node infos
   * @param nodeUri
   * @returns whether the node has children
   */
  function handleSelectChildren(nodeUri: string) {
    return fetchNodeTree(nodeUri, showErrorBars);
  }

  // Update recursively each node
  async function updateTreeNode(
    trees: CustomTreeData[],
    seeErrorBars: boolean,
  ): Promise<void> {
    for (const tree of trees) {
      if (!tree.data) continue;

      // Recursive call
      for (const node of tree.data) {
        await updateNodeRecursive(node, seeErrorBars);
      }
    }
  }

  async function updateNodeRecursive(
    node: CustomTreeNodeData,
    seeErrorBars: boolean,
  ): Promise<void> {
    // Go trhough nodes recursively (deep-first)
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        await updateNodeRecursive(child, seeErrorBars);
      }

      // Update node
      await fetchTreeNodeToUpdate(node, seeErrorBars);
    }
  }

  const fetchTreeNodeToUpdate = async (
    node: CustomTreeNodeData,
    seeErrorBars: boolean,
  ) => {
    const oldChildren = structuredClone(node.children) as CustomTreeNodeData[];
    const cleanedNodeValue = node.value.endsWith('/')
      ? node.value.slice(0, -1)
      : node.value;

    // Fetch node info with updated param seeErrorBars
    const nodeInfos: NodeInfoResponse = await fetchNodeInfos(
      cleanedNodeValue,
      seeErrorBars,
    );
    const childrenInfos = nodeInfos.children || [];

    // Fetch updated children to include/remove error bands
    const newChildren = fetchChildrenNodeInfos(
      childrenInfos,
      node.value,
      node.uriLabel,
      seeErrorBars,
    );

    // Add related childrens from config to each new children
    for (const newChild of newChildren) {
      const oldChild = oldChildren.find((old) => old.label === newChild.label);
      if (oldChild) {
        newChild.children = oldChild.children;
        newChild.seeErrorBars = seeErrorBars;
      }
    }

    // Update node
    node.children = newChildren;
    node.seeErrorBars = seeErrorBars;
  };

  /**
   * Handles see error bars
   */
  const handleSeeErrorBars = async (value: boolean) => {
    setShowErrorBars(value);
    if (searchResults) {
      handleSearchNode(value, searchAllUris);
    } else {
      // Update customDataTree with see errors param
      const updatedCustomDataTree: CustomTreeData[] = structuredClone(
        active.customDataTree,
      );
      await updateTreeNode(updatedCustomDataTree, value);
      writeCustomDataTree(active, updatedCustomDataTree);
    }
  };

  /**
   * Searches the node name in the data entry opened last, or in all of them.
   *
   * The results are shown in place of the browsed trees, which are left as
   * they are: clearing the search brings them back, with the nodes checked
   * meanwhile revealed in them.
   */
  const handleSearchNode = async (showErrors: boolean, allUris: boolean) => {
    const { active, revealTreeNodes } = useIbexStore.getState();
    if (!active) return;
    const value = formSearchNode.values.node;
    if (!value) return;

    const targets = allUris ? active.dataURI : uriSelected ? [uriSelected] : [];
    if (targets.length === 0) {
      console.error('Accordion not selected');
      showNotification({
        title: 'Search node',
        message: 'Select an uri to search',
        color: 'red',
      });
      return;
    }

    setSearchNodeIsLoading(true);
    if (checkedBeforeSearch.current === null) {
      checkedBeforeSearch.current = active.checkedNodeURI ?? [];
    }

    // One data entry failing must not hide what the others found.
    const settled = await Promise.allSettled(
      targets.map(async (dataUri) => {
        const searchResults: SearchNodeResponse = await fetchFindPaths(
          dataUri.uri,
          value,
          showErrors,
        );
        const roots =
          useIbexStore
            .getState()
            .active?.customDataTree.find((item) => item.uri === dataUri.uri)
            ?.data ?? [];
        return [dataUri.uri, buildTree(roots, dataUri, searchResults)] as const;
      }),
    );

    const results: Record<string, CustomTreeNodeData[]> = {};
    for (const result of settled) {
      if (result.status === 'fulfilled') {
        results[result.value[0]] = result.value[1];
      } else {
        console.error(result.reason);
      }
    }

    // The input may have been cleared while the search ran.
    if (formSearchNode.getValues().node !== '') {
      setSearchResults(results);
      for (const [uri, nodes] of Object.entries(results)) {
        if (nodes.length > 0) revealTreeNodes(active.name, uri, []);
      }
    }
    setSearchNodeIsLoading(false);
  };

  /** Back to the browsed trees, revealing the nodes checked in the results. */
  const clearSearch = () => {
    const before = checkedBeforeSearch.current;
    checkedBeforeSearch.current = null;
    setSearchResults(null);
    if (before === null) return;

    // A node just checked may still be on its way to the configuration.
    pendingChecks.current.then(() => {
      const checked = useIbexStore.getState().active?.checkedNodeURI ?? [];
      const added = checked.filter(
        (node) =>
          !before.some((old) => old.uri === node.uri && old.name === node.name),
      );
      if (added.length > 0) revealNodes(added.map((node) => node.uri));
    });
  };

  const handleSearchAllUris = (value: boolean) => {
    setSearchAllUris(value);
    if (searchResults) handleSearchNode(showErrorBars, value);
  };

  /** The check operations still running, so the next one waits its turn. */
  const pendingChecks = useRef<Promise<void>>(Promise.resolve());

  /**
   * Plots or removes the nodes the tree just checked or unchecked.
   *
   * Plotting awaits the backend, and a user - or a spec - can click the next
   * node before it answers. Each click used to send the whole checked list as
   * the tree saw it, and each operation wrote back the configuration it had
   * started from. So unchecking one node while another was still loading
   * computed the list without the node still loading, removed its grid, and
   * then the load finished and wrote its grid back over the removal.
   *
   * A click is therefore reduced to what it changed, against the list the tree
   * was showing when it happened, and the changes are applied one at a time,
   * each onto the configuration as the previous one left it.
   */
  const getNodesChecked = useCallback((nodes: URITreeNodeData[]) => {
    const seen = useIbexStore.getState().active?.checkedNodeURI ?? [];
    const sameNode = (a: URITreeNodeData, b: URITreeNodeData) =>
      a.uri === b.uri && a.name === b.name;
    const added = nodes.filter((node) => !seen.some((s) => sameNode(s, node)));
    const removed = seen.filter(
      (node) => !nodes.some((n) => sameNode(n, node)),
    );

    pendingChecks.current = pendingChecks.current
      .then(() =>
        applyCheckedNodes((current) => [
          ...current.filter((node) => !removed.some((r) => sameNode(r, node))),
          ...added.filter((node) => !current.some((c) => sameNode(c, node))),
        ]),
      )
      // A failed operation must not stall every click after it.
      .catch((error) => console.error('Error while checking nodes: ', error));
  }, []);

  const applyCheckedNodes = async (
    nextChecked: (current: URITreeNodeData[]) => URITreeNodeData[],
  ) => {
    const { active, editingGridId, setEditingGrid, updatedConfiguration } =
      useIbexStore.getState();
    if (!active) return;
    const nodes = nextChecked(active.checkedNodeURI);

    let updatedActive: Configuration = {
      ...active,
      checkedNodeURI: [...nodes],
    };

    try {
      let findEditablePlot = updatedActive.dataPlot.find(
        (plot) => plot.i === editingGridId,
      );

      if (!findEditablePlot) {
        updatedActive = await handleNewPlot(nodes, updatedActive);
        // `handleNewPlot` appends the grid it built, and that grid is the one
        // the user is now editing.
        findEditablePlot =
          updatedActive.dataPlot[updatedActive.dataPlot.length - 1];
        setEditingGrid(findEditablePlot?.i ?? null);
      } else {
        if (nodes.length === 0) {
          // Unchecking the last node removes the grid, so nothing is edited.
          updatedActive.dataPlot = active.dataPlot.filter(
            (plot) => plot.i !== editingGridId,
          );
          setEditingGrid(null);
        } else {
          updatedActive = await handleExistingPlot(
            nodes,
            findEditablePlot,
            updatedActive,
          );
        }
      }
    } catch (error) {
      console.error('Error while plotting a new graph: ', error);
      showNotification({
        title: 'Error',
        message: 'Unable to plot a new graph.',
        color: 'red',
      });
      // Uncheck when error occurs
      const wantedCheckedNodeURI = [...nodes];
      wantedCheckedNodeURI.pop();
      updatedActive.checkedNodeURI = wantedCheckedNodeURI;
    } finally {
      if (
        JSON.stringify(updatedActive.checkedNodeURI) ===
        JSON.stringify([...nodes])
      ) {
        // Set savable if successfully checked
        updatedActive.saved = false;
      }
      // The tree is not this operation's to write: folders loaded while it
      // plotted - revealing the grid now being edited, say - would be undone.
      const latest = useIbexStore.getState().active;
      if (latest?.name === updatedActive.name) {
        updatedActive.customDataTree = latest.customDataTree;
      }
      updatedConfiguration(updatedActive);
    }
  };

  // A column filling the panel: the tree takes whatever height the controls
  // above it leave, instead of the panel's height minus a guess at theirs.
  return (
    <Container fluid p={0} h="100%" style={FILL_COLUMN}>
      <Group justify="end" mr="sm">
        <ActionIcon
          variant="filled"
          aria-label="Settings"
          onClick={handleExtended}
          style={{
            rotate: extended ? '180deg' : '0deg',
            transition: 'transform 0.3s ease',
          }}
        >
          <IconChevronRight
            style={{ width: '70%', height: '70%' }}
            stroke={1.5}
          />
        </ActionIcon>
      </Group>

      <Transition
        mounted={extended}
        transition="scale-x"
        duration={300}
        timingFunction="ease"
      >
        {(styles) => (
          <div style={{ ...styles, ...FILL_REST }}>
            <Container fluid p={0} style={FILL_REST}>
              <Container fluid pt={1}>
                <Fieldset
                  variant="unstyled"
                  disabled={active.customDataTree.length === 0}
                >
                  <form
                    onSubmit={formSearchNode.onSubmit(() => {
                      handleSearchNode(showErrorBars, searchAllUris);
                    })}
                  >
                    <TextInput
                      label="Search node"
                      placeholder="Enter node name"
                      data-testid="search-node-input"
                      {...formSearchNode.getInputProps('node')}
                      rightSection={
                        searchNodeIsLoading ? (
                          <Loader size="xs" />
                        ) : (
                          <ActionIcon
                            variant="filled"
                            aria-label="Search node"
                            data-testid="search-node-submit"
                            component="button"
                            type="submit"
                          >
                            <IconSearch
                              style={{ width: '70%', height: '70%' }}
                              stroke={1.5}
                            />
                          </ActionIcon>
                        )
                      }
                      disabled={searchNodeIsLoading}
                    />
                  </form>
                  <Switch
                    mt="sm"
                    label="Search all URIs"
                    labelPosition="left"
                    checked={searchAllUris}
                    onChange={() => handleSearchAllUris(!searchAllUris)}
                    data-testid="search-all-uris"
                    styles={{
                      labelWrapper: {
                        width: '100%',
                      },
                    }}
                  />
                  <Switch
                    my="sm"
                    label="See errors"
                    labelPosition="left"
                    checked={showErrorBars}
                    onChange={() => handleSeeErrorBars(!showErrorBars)}
                    styles={{
                      labelWrapper: {
                        width: '100%',
                      },
                    }}
                  />
                </Fieldset>
              </Container>
              <TreeLibrariesAccordion
                value={openUris}
                searchResults={searchResults}
                customDataTree={active.customDataTree}
                checkedNodes={active.checkedNodeURI || []}
                handleAccordionChange={handleAccordionChange}
                handleSelectChildren={handleSelectChildren}
                getNodesChecked={getNodesChecked}
              />
            </Container>
          </div>
        )}
      </Transition>

      {!extended && (
        <ScrollArea style={GROW}>
          <Group justify="center" mt="sm">
            {active?.customDataTree.map((item, index) => {
              return (
                <Avatar
                  key={`avatar-${index}-${item.uri}`}
                  color={item.uriColor}
                  radius="xl"
                  onClick={() => {
                    handleExtended();
                    if (!openUris.includes(item.uri)) {
                      handleAccordionChange([...openUris, item.uri]);
                    }
                  }}
                >
                  {item.name.charAt(0).toUpperCase()}
                  {item.name.charAt(item.name.length - 1).toUpperCase()}
                </Avatar>
              );
            })}
          </Group>
        </ScrollArea>
      )}
    </Container>
  );
};
