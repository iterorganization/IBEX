import { Axis, Coordinates, DataGridPlot, URITreeNodeData } from '../types';
import { generateUuid } from './uuid';

export const findNextAvailableY = (existingPlots: DataGridPlot[]): number => {
  if (existingPlots.length === 0) return 0;

  // Trouver la position la plus basse (y + h)
  const maxY = Math.max(...existingPlots.map((plot) => plot.y + plot.h));
  return maxY;
};

export const generateNewGridPlot = (
  coordinatesOfFirstPlot: Coordinates[],
  xAxis: Axis,
  yAxis: Axis,
  existingPlots: DataGridPlot[],
  node: URITreeNodeData,
): DataGridPlot => {
  const newGrid = generateNewGrid(existingPlots, node);

  return {
    ...newGrid,
    xAxisData: xAxis,
    yAxisData: yAxis,
    coordinates: coordinatesOfFirstPlot,
  };
};

export const generateNewGrid = (
  existingPlots: DataGridPlot[],
  node: URITreeNodeData,
): DataGridPlot => {
  return {
    title: '',
    isTitleOverwritten: false,
    displayErrorBand: true,
    displayGrid: true,
    forceXyRatio: false,
    synchronizedGrids: { color: '', list: [] },
    i: generateUuid(),
    isEditing: true,
    static: true,
    plot: [],
    x: 0,
    y: findNextAvailableY(existingPlots),
    w: 6,
    h: 12,
    geometries: [],
    is_geometry_node: node.is_geometry_node,
  };
};
