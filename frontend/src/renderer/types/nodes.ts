export enum NodeInfoTypeEnum {
  STRUCTURE = 'structure',
  ARRAY = 'struct_array',
  INTEGER = 'INT',
  FLOAT = 'FLT',
  STRING = 'STR',
  COMPLEX = 'CPX',
  GEOMETRY = 'GEO', // TODO : use geometry type from BE
}

export type NodeInfoChildrenResponse = {
  name: string;
  ndim: number;
  type: NodeInfoTypeEnum;
};

export type NodeInfoResponse = NodeInfoChildrenResponse & {
  shape: number[];
  coordinates: string[];
  children: NodeInfoChildrenResponse[];
};

export type SearchNodeResponse = {
  paths: string[];
};
