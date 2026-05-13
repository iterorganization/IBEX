export enum NodeInfoTypeEnum {
  STRUCTURE = 'structure',
  ARRAY = 'struct_array',
  INTEGER = 'INT',
  FLOAT = 'FLT',
  STRING = 'STR',
  COMPLEX = 'CPX',
}

export type NodeInfoChildrenResponse = {
  name: string;
  ndim: number;
  type: NodeInfoTypeEnum;
  has_data: boolean;
};

export type NodeInfoResponse = NodeInfoChildrenResponse & {
  shape: number[];
  coordinates: string[];
  children: NodeInfoChildrenResponse[];
  has_data: boolean;
};

export type SearchNodeResponse = {
  paths: string[];
};
