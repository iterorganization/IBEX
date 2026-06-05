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
  has_data: boolean | null;
};

export type NodeInfoResponse = NodeInfoChildrenResponse & {
  shape: number[];
  coordinates: string[];
  children: NodeInfoChildrenResponse[];
  has_data: boolean | null;
};

export type SearchNodeResponse = {
  paths: string[];
};
