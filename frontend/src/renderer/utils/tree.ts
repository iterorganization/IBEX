import {
  CustomTreeData,
  CustomTreeNodeData,
  NodeInfoTypeEnum,
  SearchNodeResponse,
  URIData,
} from '../types';

export const buildTree = (
  tree: CustomTreeNodeData[],
  dataUri: URIData,
  searchResults: SearchNodeResponse,
): CustomTreeNodeData[] => {
  // Reset the children for each ids
  tree.forEach((node) => {
    node.children = [];
  });

  searchResults.paths.forEach((path) => {
    const cleanPath = path.path.replace(/^#/, '').split('/');
    let currentNode = tree;
    let findValue = dataUri.uri;

    cleanPath.forEach((segment, index) => {
      const isArray = segment.includes('[:]');
      const cleanSegment = segment.replace(/\[:\]/g, '[0]');
      const segmentLabel = isArray
        ? cleanSegment.replace(/\[0\]/g, '')
        : cleanSegment;
      const isLastElement = index === cleanPath.length - 1;

      // Get the value of the node
      findValue +=
        index === 0
          ? `#${cleanSegment}:0/`
          : isLastElement
            ? `${cleanSegment}`
            : `${cleanSegment}/`;

      // Check if the node already exists
      let existingNode = currentNode.find((node) => node.value === findValue);

      if (!existingNode) {
        // Determine the type of the node
        let nodeType: NodeInfoTypeEnum;
        if (isArray) {
          nodeType = NodeInfoTypeEnum.ARRAY;
        } else if (index === cleanPath.length - 1) {
          nodeType = NodeInfoTypeEnum.FLOAT;
        } else {
          nodeType = NodeInfoTypeEnum.STRUCTURE;
        }

        // Create the new node
        const newNode: CustomTreeNodeData = {
          label: segmentLabel,
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
      expendAll: false,
    };
  });

  return newCustomDataTree;
};
