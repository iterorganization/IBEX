import { Axis, Coordinates, DataGridPlot } from '../types';
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
  y2Axis?: Axis,
): DataGridPlot => {
  const newGrid = generateNewGrid(existingPlots);

  return {
    ...newGrid,
    xAxisData: xAxis,
    yAxisData: yAxis,
    y2AxisData: y2Axis,
    coordinates: coordinatesOfFirstPlot,
  };
};

export const generateNewGrid = (
  existingPlots: DataGridPlot[],
): DataGridPlot => {
  return {
    title: '',
    isTitleOverwritten: false,
    displayErrorBand: true,
    displayGrid: true,
    i: generateUuid(),
    isEditing: true,
    static: true,
    plot: [],
    x: 0,
    y: findNextAvailableY(existingPlots),
    w: 6,
    h: 12,
  };
};
