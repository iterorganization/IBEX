import { AxisData, Coordinates } from '../types';
import * as tf from '@tensorflow/tfjs';

export const getFirstArrayValueFromShape = (
  value: AxisData,
  shape: number[] | 'irregular',
): number[] => {
  if (shape === 'irregular') {
    // Get shape whe irregular
    const tensor = tf.tensor(value);
    shape = tensor.shape;
  }

  let firstArrayValue: AxisData | number | string = value;
  for (let index = 0; index < shape.length - 1; index++) {
    if (Array.isArray(firstArrayValue)) {
      firstArrayValue = firstArrayValue[0];
    }
  }

  // For higher dimensions (3D or more), return the first element of the first array
  return firstArrayValue as number[];
};

/**
 * Get vector from coordinates dependencies
 * @param coordinates
 * @param axeIndexWanted
 */
export const getArrayValueFromDependance = (
  coordinates: Coordinates[],
  axeIndexWanted: number,
) => {
  const wantedCoordinate: Coordinates = coordinates.find(
    (coord) => coord.axeIndex === axeIndexWanted,
  );
  if (!wantedCoordinate.coordinates.length) {
    // get first array value when having no dependance
    return getFirstArrayValueFromShape(
      wantedCoordinate.data,
      wantedCoordinate.shape as number[],
    );
  }

  // get sorted valueIndex list (sorted by shape length) to access to data matrix
  const dependances = wantedCoordinate.coordinates;
  const sortedIndexValueDependances: number[] = [];

  let tensor;
  if (wantedCoordinate.shape === 'irregular') {
    // get shape when irregular data
    tensor = tf.tensor(wantedCoordinate.data);
  }
  for (const shapeElement of wantedCoordinate.shape === 'irregular'
    ? tensor.shape
    : wantedCoordinate.shape) {
    const coordDep = coordinates.find(
      (coord_dep) =>
        dependances.includes(coord_dep.name) &&
        coord_dep.shape[coord_dep.shape.length - 1] === shapeElement,
    );
    if (coordDep) {
      sortedIndexValueDependances.push(coordDep.valueIndex);
    }
  }

  // Get wanted coordinate data from dependencies not linked to the dimension
  let coordinateData: (number | string) | AxisData = wantedCoordinate.data;
  for (const vectorIndex of sortedIndexValueDependances) {
    if (Array.isArray(coordinateData)) {
      coordinateData = coordinateData[vectorIndex];
    }
  }

  return coordinateData as string[] | number[];
};

export const is3DMatrix = (shape: number[]): boolean => {
  // A 3D matrix has a shape with at least 2 dimensions
  return shape.length >= 2;
};
