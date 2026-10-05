import {
  Checkbox,
  getTreeExpandedState,
  Group,
  Loader,
  RenderTreeNodePayload,
  ScrollArea,
  Text,
  Tooltip,
  Tree,
  UseTreeReturnType,
  useTree,
} from '@mantine/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  IconMathFunction,
  IconFileUnknown,
  IconFolder,
  IconFolderOpen,
  IconHash,
  IconRipple,
  IconTypography,
} from '@tabler/icons-react';
import classes from './TreeLibrary.module.css';
import {
  CustomTreeNodeData,
  NodeInfoTypeEnum,
  URITreeNodeData,
} from '../../types';
import { useIbexStore } from '../../stores';

interface NodeIconProps {
  node: CustomTreeNodeData;
  type: NodeInfoTypeEnum;
  uriLabel: string;
  expanded: boolean;
  loading: boolean;
  checkedNodes: URITreeNodeData[];
  tree: UseTreeReturnType;
  shouldDisableTree: boolean;
  textRef: React.RefObject<HTMLDivElement>;
  isOverflowing: boolean;
  getCheckedNodes: (nodes: URITreeNodeData[]) => void;
}

interface TreeLibraryProps {
  treeData: CustomTreeNodeData[];
  /** The data entry this tree browses. */
  uri: string;
  /**
   * `browse` keeps its expanded nodes in the store, so they outlive this
   * component; `search` shows a search's results, all expanded, and forgets
   * them with the search.
   */
  mode: 'browse' | 'search';
  height?: string;
  checkedNodes?: URITreeNodeData[];
  metadataGridLayout?: string;
  customizedGridLayout?: string;
  /** Loads the children of a node; resolves whether it has any. */
  handleSelectChildren: (nodeUri: string) => Promise<boolean>;
  getCheckedNodes?: (nodes: URITreeNodeData[]) => void;
}

interface ElementProps extends RenderTreeNodePayload {
  node: CustomTreeNodeData;
  type: NodeInfoTypeEnum;
  uriLabel: string;
  checkedNodes?: URITreeNodeData[];
  tree: UseTreeReturnType;
  shouldDisableTree: boolean;
  setExpanded: (nodeValue: string, expanded: boolean) => void;
  handleSelectChildren: (nodeUri: string) => Promise<boolean>;
  getCheckedNodes: (nodes: URITreeNodeData[]) => void;
}

function Element({
  node,
  expanded,
  elementProps,
  type,
  checkedNodes,
  tree,
  shouldDisableTree,
  uriLabel,
  setExpanded,
  handleSelectChildren,
  getCheckedNodes,
}: ElementProps) {
  const textRef = useRef<HTMLDivElement>(null);
  const [isTextOverflowing, setIsTextOverflowing] = useState(false);
  const [loading, setLoading] = useState(false);

  const isFolder =
    type === NodeInfoTypeEnum.STRUCTURE || type === NodeInfoTypeEnum.ARRAY;
  // A node only counts as open when its subtree is on screen: one marked
  // expanded over children that are not loaded (yet, or any more) is closed.
  const isOpen = expanded && node.children?.length > 0;

  useEffect(() => {
    const el = textRef.current;
    if (!el) return;

    const checkOverflow = () => {
      setIsTextOverflowing(el.scrollWidth > el.offsetWidth);
    };

    checkOverflow();

    // Check overflow each time container width change
    const resizeObserver = new ResizeObserver(checkOverflow);
    resizeObserver.observe(el);

    return () => resizeObserver.disconnect();
  }, [node.label]);

  /**
   * Opens a folder once its children are there, or closes it.
   *
   * Expanding first and loading from an effect on `expanded` left the folder
   * open over nothing whenever the load was slow, failed or came back empty.
   */
  const handleExpandTree = async () => {
    if (!isFolder || loading) return;
    if (isOpen) {
      setExpanded(node.value, false);
      return;
    }
    let hasChildren = node.children?.length > 0;
    if (!hasChildren) {
      setLoading(true);
      try {
        hasChildren = await handleSelectChildren(node.value);
      } finally {
        setLoading(false);
      }
    }
    if (hasChildren) setExpanded(node.value, true);
  };

  return (
    <Group gap={5} {...elementProps} onClick={handleExpandTree} wrap="nowrap">
      <NodeIcon
        type={type}
        uriLabel={uriLabel}
        expanded={isOpen}
        loading={loading}
        node={node}
        checkedNodes={checkedNodes}
        tree={tree}
        shouldDisableTree={shouldDisableTree}
        textRef={textRef}
        isOverflowing={isTextOverflowing}
        getCheckedNodes={getCheckedNodes}
      />
    </Group>
  );
}

function NodeIcon({
  node,
  type,
  expanded,
  loading,
  checkedNodes,
  tree,
  shouldDisableTree,
  isOverflowing,
  textRef,
  uriLabel,
  getCheckedNodes,
}: NodeIconProps) {
  const [checked, setChecked] = useState<boolean>(false);

  useEffect(() => {
    setChecked(
      checkedNodes.some((checkedNode) => checkedNode.uri === node.value),
    );
  }, [checkedNodes]);

  const getNodeIcon = (type: NodeInfoTypeEnum, expanded: boolean) => {
    const commonProps = {
      size: 14,
      stroke: 2.5,
      color: 'var(--mantine-color-blue-8)',
    };

    const handleCheckNode = useCallback(() => {
      if (
        shouldDisableTree ||
        node.label.toString().endsWith('_error_lower') ||
        node.label.toString().endsWith('_error_upper') ||
        (node.is_geometry_node === true &&
          checkedNodes.length &&
          checkedNodes[0].is_geometry_node !== true &&
          checkedNodes[0]?.type !== 'STR')
      ) {
        return;
      }
      if (
        [
          NodeInfoTypeEnum.INTEGER,
          NodeInfoTypeEnum.FLOAT,
          NodeInfoTypeEnum.STRING,
          NodeInfoTypeEnum.COMPLEX,
        ].includes(type)
      ) {
        if (checked) {
          // Remove node & his error bands
          const nodesToUncheck = checkedNodes.filter(
            (checkedNode) =>
              checkedNode.uri === node.value ||
              checkedNode.uri === node.value + '_error_upper' ||
              checkedNode.uri === node.value + '_error_lower',
          );

          // Uncheck node & his error bands
          for (const nodeToUncheck of nodesToUncheck) {
            tree.uncheckNode(nodeToUncheck.uri);
          }

          checkedNodes = checkedNodes.filter(
            (uncheckedNode) =>
              uncheckedNode.uri !== node.value &&
              uncheckedNode.uri !== node.value + '_error_upper' &&
              uncheckedNode.uri !== node.value + '_error_lower',
          );
        } else {
          // Add node
          tree.checkNode(node.value);
          const newCheckedNode: URITreeNodeData = {
            name: uriLabel,
            uri: node.value,
            type: node.type,
            is_geometry_node: node.is_geometry_node,
          };
          checkedNodes.push(newCheckedNode);
        }
        setChecked(!checked);
        getCheckedNodes(checkedNodes);
      }
    }, [checked, checkedNodes, getCheckedNodes, node.value, tree, type]);

    const labels = (
      <Tooltip label={node.label} position="left" disabled={!isOverflowing}>
        <Text truncate="end" ref={textRef} w="auto">
          {node.label}
        </Text>
      </Tooltip>
    );

    const getFolderIcon = () => (
      <Group
        gap={2}
        wrap="nowrap"
        data-testid={`folder-${node.value}`}
        data-open={expanded}
      >
        {loading ? (
          <Loader size={14} className={classes.forcedWidth} />
        ) : expanded ? (
          <IconFolderOpen {...commonProps} className={classes.forcedWidth} />
        ) : (
          <IconFolder {...commonProps} className={classes.forcedWidth} />
        )}
        {labels}
      </Group>
    );

    const getCheckboxIcon = (IconComponent: JSX.Element) => (
      <Tooltip label={node.label} position="left" disabled={!isOverflowing}>
        <Group
          gap={2}
          style={{
            cursor:
              shouldDisableTree ||
              node.label.toString().endsWith('_error_lower') ||
              node.label.toString().endsWith('_error_upper') ||
              (node.is_geometry_node === true &&
                checkedNodes.length &&
                checkedNodes[0].is_geometry_node !== true &&
                checkedNodes[0]?.type !== 'STR')
                ? 'not-allowed'
                : 'pointer',
          }}
          wrap="nowrap"
          onClick={handleCheckNode}
          data-testid={`checkbox-${node.value}`}
        >
          <Checkbox
            checked={checked}
            readOnly
            styles={{
              input: {
                minWidth: 20,
                minHeight: 20,
              },
            }}
            disabled={
              shouldDisableTree ||
              node.label.toString().endsWith('_error_lower') ||
              node.label.toString().endsWith('_error_upper') ||
              (node.is_geometry_node === true &&
                checkedNodes.length &&
                checkedNodes[0].is_geometry_node !== true &&
                checkedNodes[0]?.type !== 'STR')
            }
          />
          {IconComponent}
          <Text truncate="end" ref={textRef} w="auto">
            {node.label}
          </Text>
        </Group>
      </Tooltip>
    );

    const icons: Record<NodeInfoTypeEnum, JSX.Element> = {
      [NodeInfoTypeEnum.STRUCTURE]: getFolderIcon(),
      [NodeInfoTypeEnum.ARRAY]: getFolderIcon(),
      [NodeInfoTypeEnum.INTEGER]: getCheckboxIcon(
        <IconHash {...commonProps} className={classes.forcedWidth} />,
      ),
      [NodeInfoTypeEnum.FLOAT]: getCheckboxIcon(
        <IconRipple {...commonProps} className={classes.forcedWidth} />,
      ),
      [NodeInfoTypeEnum.STRING]: getCheckboxIcon(
        <IconTypography {...commonProps} className={classes.forcedWidth} />,
      ),
      [NodeInfoTypeEnum.COMPLEX]: getCheckboxIcon(
        <IconMathFunction {...commonProps} className={classes.forcedWidth} />,
      ),
    };

    return (
      icons[type] || (
        <IconFileUnknown {...commonProps} className={classes.forcedWidth} />
      )
    );
  };

  return type ? (
    getNodeIcon(type, expanded)
  ) : (
    <IconFileUnknown
      size={14}
      className={classes.forcedWidth}
      stroke={2.5}
      color="var(--mantine-color-blue-8)"
    />
  );
}

const NO_EXPANDED_NODES: string[] = [];

export const TreeLibrary = ({
  treeData,
  uri,
  mode,
  height,
  checkedNodes,
  metadataGridLayout,
  customizedGridLayout,
  handleSelectChildren,
  getCheckedNodes,
}: TreeLibraryProps) => {
  const tree = useTree();
  const [shouldDisableTree, setShouldDisableTree] = useState<boolean>(false);
  const configurationName = useIbexStore((state) => state.active?.name);
  const expandedNodes =
    useIbexStore(
      (state) => state.treeView[state.active?.name]?.expanded[uri],
    ) ?? NO_EXPANDED_NODES;
  const setTreeNodeExpanded = useIbexStore(
    (state) => state.setTreeNodeExpanded,
  );

  const handleDisableTree = (
    metadataGridLayout?: string,
    customizedGridLayout?: string,
  ) => {
    if (metadataGridLayout || customizedGridLayout) {
      setShouldDisableTree(true);
    } else {
      setShouldDisableTree(false);
    }
  };

  const browsedExpandedState = useMemo(
    () => Object.fromEntries(expandedNodes.map((value) => [value, true])),
    [expandedNodes],
  );

  // The store is the source of truth in browse mode. `Tree` re-initializes its
  // controller whenever the data changes, dropping the nodes not loaded yet, so
  // this also runs on data changes (it runs after `Tree`'s own effect).
  useEffect(() => {
    tree.setExpandedState(
      mode === 'search'
        ? getTreeExpandedState(treeData, '*')
        : browsedExpandedState,
    );
  }, [mode, browsedExpandedState, treeData]);

  const setExpanded = useCallback(
    (nodeValue: string, expanded: boolean) => {
      if (mode === 'search') {
        if (expanded) tree.expand(nodeValue);
        else tree.collapse(nodeValue);
        return;
      }
      if (!configurationName) return;
      setTreeNodeExpanded(configurationName, uri, nodeValue, expanded);
    },
    [mode, tree, configurationName, uri, setTreeNodeExpanded],
  );

  useEffect(() => {
    handleDisableTree(metadataGridLayout, customizedGridLayout);
  }, [metadataGridLayout, customizedGridLayout]);

  return (
    <ScrollArea h={height}>
      <Tree
        tree={tree}
        data={treeData}
        className={classes.tree}
        expandOnClick={false}
        renderNode={(payload) => {
          return (
            <Element
              {...payload}
              node={payload.node as CustomTreeNodeData}
              type={(payload.node as CustomTreeNodeData).type}
              uriLabel={(payload.node as CustomTreeNodeData).uriLabel}
              tree={tree}
              shouldDisableTree={shouldDisableTree}
              checkedNodes={checkedNodes}
              setExpanded={setExpanded}
              handleSelectChildren={handleSelectChildren}
              getCheckedNodes={getCheckedNodes}
            />
          );
        }}
      />
    </ScrollArea>
  );
};
