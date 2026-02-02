import {
  Checkbox,
  Group,
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
import { hasUserSelectedText } from '../../utils';
import { useIbexStore } from '../../stores';

interface NodeIconProps {
  node: CustomTreeNodeData;
  type: NodeInfoTypeEnum;
  uriLabel: string;
  expanded: boolean;
  checkedNodes: URITreeNodeData[];
  tree: UseTreeReturnType;
  textRef: React.RefObject<HTMLDivElement>;
  isOverflowing: boolean;
  getCheckedNodes: (nodes: URITreeNodeData[]) => void;
}

interface TreeLibraryProps {
  treeData: CustomTreeNodeData[];
  height?: string;
  checkedNodes?: URITreeNodeData[];
  expendAll?: boolean;
  handleSelectChildren: (nodeUri: string) => Promise<void>;
  getCheckedNodes?: (nodes: URITreeNodeData[]) => void;
  getCurrentSelectedURI: () => string;
  handleAccordionChange(value: string): Promise<void>;
}

interface ElementProps extends RenderTreeNodePayload {
  node: CustomTreeNodeData;
  type: NodeInfoTypeEnum;
  uriLabel: string;
  selectedNode: string | null;
  checkedNodes?: URITreeNodeData[];
  tree: UseTreeReturnType;
  setSelectedNode: (node: string | null) => void;
  handleSelectChildren: (nodeUri: string) => Promise<void>;
  getCheckedNodes: (nodes: URITreeNodeData[]) => void;
}

function Element({
  node,
  expanded,
  elementProps,
  type,
  selectedNode,
  checkedNodes,
  tree,
  uriLabel,
  setSelectedNode,
  handleSelectChildren,
  getCheckedNodes,
}: ElementProps) {
  const textRef = useRef<HTMLDivElement>(null);
  const [isTextOverflowing, setIsTextOverflowing] = useState(false);

  const fetchData = async () => {
    if (
      type === NodeInfoTypeEnum.STRUCTURE ||
      type === NodeInfoTypeEnum.ARRAY
    ) {
      await handleSelectChildren(node.value);
    }
  };

  useEffect(() => {
    if (expanded) {
      setSelectedNode(node.value);
    } else if (!expanded) {
      setSelectedNode(null);
    }
  }, [expanded]);

  useEffect(() => {
    if (selectedNode == node.value && expanded) {
      fetchData();
    }
  }, [selectedNode]);

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

  const handleExpandTree = () => {
    // open node tree only if user don't select text
    if (hasUserSelectedText()) {
      return;
    }

    if (!expanded) {
      tree.expand(node.value);
    } else {
      tree.collapse(node.value);
    }
  };

  return (
    <Group gap={5} {...elementProps} onClick={handleExpandTree} wrap="nowrap">
      <NodeIcon
        type={type}
        uriLabel={uriLabel}
        expanded={expanded}
        node={node}
        checkedNodes={checkedNodes}
        tree={tree}
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
  checkedNodes,
  tree,
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
        node.label.toString().endsWith('_error_lower') ||
        node.label.toString().endsWith('_error_upper')
      ) {
        return;
      }
      if (
        [
          NodeInfoTypeEnum.INTEGER,
          NodeInfoTypeEnum.FLOAT,
          NodeInfoTypeEnum.STRING,
        ].includes(type)
      ) {
        if (hasUserSelectedText()) {
          return;
        }

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
        style={{ userSelect: 'text' }}
        wrap="nowrap"
        data-testid={`folder-${node.value}`}
      >
        {expanded ? (
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
            userSelect: 'text',
            cursor:
              node.label.toString().endsWith('_error_lower') ||
              node.label.toString().endsWith('_error_upper')
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
              node.label.toString().endsWith('_error_lower') ||
              node.label.toString().endsWith('_error_upper')
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

export const TreeLibrary = ({
  treeData,
  height,
  checkedNodes,
  expendAll,
  handleSelectChildren,
  getCheckedNodes,
  getCurrentSelectedURI,
  handleAccordionChange,
}: TreeLibraryProps) => {
  const { active } = useIbexStore();
  const tree = useTree();
  const [selectedNode, setSelectedNode] = useState<string>(null);

  const expandNodesWithFiles = (nodes: CustomTreeNodeData[]) => {
    const expandRecursively = (node: CustomTreeNodeData) => {
      if (!node.children || node.children.length === 0) return; // No data on folder

      // If the node has files, expand it
      const hasFiles = node.children.length > 0;

      if (hasFiles) {
        tree.expand(node.value);
      }

      // Recursively expand children
      node.children.forEach(expandRecursively);
    };

    nodes.forEach((node) => {
      if (node.children.length > 0) {
        tree.expand(node.value);
      }
      expandRecursively(node);
    });
  };

  useEffect(() => {
    if (expendAll) {
      expandNodesWithFiles(treeData);
    } else {
      tree.collapseAllNodes();
      tree.clearSelected();
    }
  }, [expendAll]);

  const isEditingPlot = useMemo(
    () => active?.dataPlot?.map((p) => p.isEditing).join(','),
    [active],
  );

  useEffect(() => {
    if (!active?.dataPlot) return;

    const run = async () => {
      const dataPlot = active.dataPlot.find((p) => p.isEditing);
      if (!dataPlot || dataPlot.plot.length === 0) return;

      let selectedURI: string | undefined = undefined;

      for (const plot of dataPlot.plot) {
        const plotUriSplit = plot.nodeUri.split('#');
        const plotUri = plotUriSplit[0];
        const nodeList = plotUriSplit[1]
          .replace(/\[\d+\]/g, '[:]')
          .split(/(?<=\/)/);
        nodeList.pop();

        if (!plotUri || plotUri === '') {
          continue;
        }

        if (!nodeList || nodeList.length === 0) {
          continue;
        }

        if (!selectedURI || selectedURI === plotUri) {
          selectedURI = plotUri;

          if (selectedURI !== getCurrentSelectedURI()) {
            await handleAccordionChange(selectedURI);
          }

          let endPoint = selectedURI + '#';
          const { active } = useIbexStore.getState();
          let customTreeNodeData = active.customDataTree.find(
            (customTreeData) => customTreeData.uri === selectedURI,
          )?.data;
          let nodeLoaded = true;
          for (const node of nodeList) {
            endPoint += node;
            customTreeNodeData = customTreeNodeData?.find(
              (customTreeData) => customTreeData.value === endPoint,
            )?.children;
            if (
              !nodeLoaded ||
              !customTreeNodeData ||
              customTreeNodeData.length === 0
            ) {
              nodeLoaded = false;
              await handleSelectChildren(endPoint);
            }
            setSelectedNode(endPoint);
            tree.expand(endPoint);
          }
        }
      }
    };

    run();
  }, [isEditingPlot]);

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
              selectedNode={selectedNode}
              tree={tree}
              checkedNodes={checkedNodes}
              setSelectedNode={setSelectedNode}
              handleSelectChildren={handleSelectChildren}
              getCheckedNodes={getCheckedNodes}
            />
          );
        }}
      />
    </ScrollArea>
  );
};
