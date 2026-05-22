import { URIData, URITreeNodeData } from './uri';
import { DataGridPlot, DataGridPlotToSave } from './plot';
import { CustomTreeData } from './tree';

export interface BaseConfiguration {
  name: string;
  dataURI: URIData[];
  lastLocalDataSetSelected?: string;
  lastURIInput?: string;
}

export type CustomizedGridType = 'data' | 'visual';

export type CustomizedGrid = {
  id: string;
  type: CustomizedGridType;
};

export interface Configuration extends BaseConfiguration {
  checkedNodeURI: URITreeNodeData[];
  customDataTree: CustomTreeData[];
  dataPlot: DataGridPlot[];
  path?: string;
  saved?: boolean;
  metadataGridLayout?: string | null;
  customizedGridLayout?: CustomizedGrid | null;
}

export interface ConfigurationToSave extends BaseConfiguration {
  dataPlot: DataGridPlotToSave[];
}

export interface ConfigForm {
  name: string;
}
