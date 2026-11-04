import {
  CustomTreeData,
  CustomTreeNodeData,
  NodeInfoTypeEnum,
  SearchNodeResponse,
  URIData,
} from '../types';

/**
 * Builds the tree of a search's results, leaving the browsed tree alone.
 *
 * It used to empty the children of the browsed tree's roots and grow the
 * results in their place, so a search threw away everything the user had
 * expanded. Node values are the browsed tree's own (`[:]` kept, not turned
 * into `[0]`): a leaf checked among the results is then the same node as in
 * the browsed tree, checked there too and revealed there once the search is
 * cleared. Plotting still reads index 0, as `getDefaultUri` maps `[:]` to it.
 */
export const buildTree = (
  roots: CustomTreeNodeData[],
  dataUri: URIData,
  searchResults: SearchNodeResponse,
): CustomTreeNodeData[] => {
  const tree: CustomTreeNodeData[] = [];

  searchResults.paths.forEach((path) => {
    const cleanPath = path.path.replace(/^#/, '').split('/');
    let currentNode = tree;
    let findValue = dataUri.uri;

    cleanPath.forEach((segment, index) => {
      const isArray = segment.includes('[:]');
      const segmentLabel = segment.replace(/\[:\]/g, '');
      const isLastElement = index === cleanPath.length - 1;

      // Get the value of the node
      findValue +=
        index === 0
          ? `#${segment}:0/`
          : isLastElement
            ? `${segment}`
            : `${segment}/`;

      // Check if the node already exists
      let existingNode = currentNode.find((node) => node.value === findValue);

      if (!existingNode) {
        const root =
          index === 0 && roots.find((node) => node.value === findValue);

        // Determine the type of the node
        let nodeType: NodeInfoTypeEnum;
        if (isArray) {
          nodeType = NodeInfoTypeEnum.ARRAY;
        } else if (isLastElement) {
          nodeType = NodeInfoTypeEnum.FLOAT;
        } else {
          nodeType = NodeInfoTypeEnum.STRUCTURE;
        }

        // Create the new node
        const newNode: CustomTreeNodeData = root
          ? { ...root, children: [] }
          : {
              label: index === 0 ? `${segmentLabel}:0` : segmentLabel,
              value: findValue,
              type: nodeType,
              children: [],
              uriLabel: dataUri.name,
              seeErrorBars: false,
              is_geometry_node: path.is_geometry_node,
            };

        // Add the new node to the tree
        currentNode.push(newNode);
        existingNode = newNode;
      }

      // Move to the next node
      currentNode = existingNode.children;
    });
  });
  return tree;
};

export const updateCustomDataTree = (
  customTreeData: CustomTreeData[],
  dataURI: URIData[],
): CustomTreeData[] => {
  const newCustomDataTree: CustomTreeData[] = dataURI.map((ids) => {
    const existingItem = customTreeData.find((item) => item.uri === ids.uri);

    return {
      name: ids.name,
      uri: ids.uri,
      data: existingItem ? existingItem.data : [],
      uriColor: existingItem ? existingItem.uriColor : ids.uriColor,
    };
  });

  return newCustomDataTree;
};

/** Finds the node of value `value`, descending only into its ancestors. */
export const findTreeNode = (
  nodes: CustomTreeNodeData[],
  value: string,
): CustomTreeNodeData | undefined => {
  for (const node of nodes) {
    if (node.value === value) return node;
    if (value.startsWith(node.value) && node.children?.length) {
      const found = findTreeNode(node.children, value);
      if (found) return found;
    }
  }
  return undefined;
};

/**
 * Replaces the node of value `value` by `update(node)`, copying only the path
 * down to it: every other subtree keeps its identity.
 */
export const mapTreeNode = (
  nodes: CustomTreeNodeData[],
  value: string,
  update: (node: CustomTreeNodeData) => CustomTreeNodeData,
): CustomTreeNodeData[] =>
  nodes.map((node) => {
    if (node.value === value) return update(node);
    if (value.startsWith(node.value) && node.children?.length) {
      const children = mapTreeNode(node.children, value, update);
      return children.some((child, index) => child !== node.children[index])
        ? { ...node, children }
        : node;
    }
    return node;
  });
