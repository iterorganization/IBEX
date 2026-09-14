import { TreeNodeData } from '@mantine/core';
import { NodeInfoTypeEnum } from './nodes';
import { URIData } from './uri';

export type DataTreeSelected = {
  path: string;
};

export type CustomTreeNodeData = TreeNodeData & {
  type: NodeInfoTypeEnum;
  seeErrorBars: boolean;
  uriLabel: string;
  children: CustomTreeNodeData[];
  is_geometry_node: boolean;
};

export type CustomTreeData = URIData & {
  data: CustomTreeNodeData[];
  expendAll: boolean;
};

export type CheckedNodeURI = {
  uri: string;
  uriSelected: string;
};
