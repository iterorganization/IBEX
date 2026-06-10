import { Data } from 'plotly.js';
import { Layout } from 'react-grid-layout';
import { NodeInfoTypeEnum } from './nodes';

export interface Axis {
  name: string;
  unit: string;
  path?: string;
  type?: string;
}

export type Complex = {
  r: number;
  i: number;
};

export type AxisData =
  | (number | string | Complex)[][][][]
  | (number | string | Complex)[][][]
  | (number | string | Complex)[][]
  | (number | string | Complex)[];

export interface BaseCoordinates {
  axeIndex: number;
  path: string;
  target: string;
  valueIndex: number;
  range?: [number, number];
  rangeValues?: [number, number] | [string, string];
}

export interface Coordinates extends BaseCoordinates {
  name: string;
  shape: number[] | 'irregular';
  coord_dependencies: string[];
  data: AxisData;
  unit?: string;
}

export interface BaseDataPlotly {
  nodeUri: string;
  labelUri: string;
  yaxis?: string;
  customPreferences?: CustomPreferences;
  line?: PlotLine;
  mode?: string;
}

export type Geometry = {
  type: 'scatter';
  mode: 'lines';
  x: number[];
  y: number[];
  line: GeometryLine;
  geometryUri: string;
  nodeUris: string[];
  name: string;
  legendgroup: string;
  showlegend: boolean;
  fill?: 'toself';
};

type GeometryLine = {
  color: string;
  width: number;
};

export type DataPlotly = BaseDataPlotly &
  Data & {
    x: (string | number)[];
    y: (string | number)[];
    yData: AxisData;
    unit: string;
    error_bands?: ErrorBandData[];
    path?: string;
    dimensions?: number;
    shape?: number[];
    description?: string;
    hovertemplate?: string;
    customdata?: Datum[] | Datum[][];
    connectgaps?: boolean;
  };

type Datum = string | number | Date;

export type ErrorBandData = {
  path: string;
  yData: AxisData;
  array: Datum[];
};

export type CustomPreferences = {
  colorscale?: string;
};

export type PlotLine = {
  color?: string;
  shape?: string;
};

export interface BaseDataGridPlot {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  isTitleOverwritten: boolean;
  displayErrorBand: boolean;
  displayGrid: boolean;
  synchronizedGrids: synchronizedList;
  downsampled_method?: string;
  downsampled_size?: number;
  interpolated_method?: string;
  xAxisData?: Axis;
  yAxisData?: Axis;
  y2AxisData?: Axis;
}

export interface DataGridPlot extends Layout, BaseDataGridPlot {
  plot: DataPlotly[];
  isEditing: boolean;
  dataType?: NodeInfoTypeEnum;
  coordinates?: Coordinates[];
  downsampled_method?: string;
  downsampled_size?: number;
  selectedPlotMode?: PlotType;
  geometrie: Geometry[];
  is_geometry_node: boolean;
}

export interface DataGridPlotToSave extends BaseDataGridPlot {
  dataType: NodeInfoTypeEnum;
  plot: BaseDataPlotly[];
  coordinates: BaseCoordinates[];
  is_geometry_node: boolean;
  geometrie: Partial<Geometry>[];
}

export type synchronizedList = {
  color: string;
  list: string[];
};

export type PlotType = '1D' | 'Heatmap' | 'Contour';
