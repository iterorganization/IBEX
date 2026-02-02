import { NodeInfoTypeEnum } from './nodes';

export type URIData = {
  name: string;
  uri: string;
  uriColor?: string;
};

export type URISelectionData = URIData & {
  isSelected: boolean;
};

export type URITreeNodeData = {
  name: string;
  uri: string;
  type: NodeInfoTypeEnum;
};

export type URIExistsResponse = {
  exists: boolean;
};

export type URIFromPathResponse = {
  uri: string;
};

export type URDataEntriesResponse = {
  entries: string[];
};

export interface FormDbEntries {
  user: string;
  backend: string;
  database: string;
  version: string;
}
