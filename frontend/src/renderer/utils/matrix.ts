import { AxisData, Complex, Coordinates } from '../types';
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

  let firstArrayValue: AxisData | number | string | Complex = value;
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
  if (!wantedCoordinate.coord_dependencies.length) {
    // get first array value when having no dependance
    return getFirstArrayValueFromShape(
      wantedCoordinate.data,
      wantedCoordinate.shape as number[],
    );
  }

  // get sorted valueIndex list (sorted by shape length) to access to data matrix
  const dependances = structuredClone(
    wantedCoordinate.coord_dependencies,
  ).reverse();
  const sortedIndexValueDependances: number[] = [];
  for (const dependance of dependances) {
    const coordDep = coordinates.find(
      (coord_dep) => coord_dep.name === dependance,
    );
    if (coordDep) {
      sortedIndexValueDependances.push(coordDep.valueIndex);
    }
  }

  // Get wanted coordinate data from dependencies not linked to the dimension
  let coordinateData: (number | string | Complex) | AxisData =
    wantedCoordinate.data;
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

/**
 * @description Retrieves vector data from a plot item based on the provided URI and coordinates.
 * @param uri The URI to retrieve the vector data from.
 * @param coordinates The coordinates to use for retrieving the vector data.
 * @param plotItem The plot item containing the yData to extract the vector from.
 * @returns The vector data as an array of numbers, or undefined if the indices are invalid
 */
export function getVectorData(coordinates: Coordinates[], yData: AxisData) {
  const coordinatesLength: number = coordinates.length;

  // Extract only matrix indexes.
  // Only `axeIndex` and `valueIndex` are read, so project onto those two
  // numbers before sorting: cloning the coordinates would deep-copy every
  // coordinate's full `data` array, and this runs on every slider tick and on
  // the render path of every plot.
  const matrixIndexes = coordinates
    .map((coord: Coordinates) => ({
      axeIndex: coord.axeIndex,
      valueIndex: coord.valueIndex,
    }))
    .sort(compareByAxeIndex)
    .reverse()
    .filter((coord) => coord.axeIndex !== 0)
    .map((coord) => coord.valueIndex);

  // Retrieve vector to plot
  /* eslint-disable  @typescript-eslint/no-explicit-any */
  let result: any = yData;
  let shapeIndex = 0;
  for (const index of matrixIndexes) {
    if (shapeIndex < coordinatesLength && index < result.length) {
      result = result[index];
      shapeIndex++;
    } else {
      if (!(shapeIndex < coordinatesLength)) {
        break;
      } else {
        console.warn('Impossible to plot: invalid index or incorrect length');
        return undefined;
      }
    }
  }
  const vectorData: number[] = result;
  return vectorData;
}

/**
 * @description Compares two Coordinates objects by their axeIndex.
 * @param a The first Coordinates object.
 * @param b The second Coordinates object.
 * @returns A negative number if a's axeIndex is less than b's, a positive number if greater, or 0 if equal.
 */
export function compareByAxeIndex(
  a: { axeIndex: number },
  b: { axeIndex: number },
) {
  if (a.axeIndex < b.axeIndex) {
    return -1;
  } else if (a.axeIndex > b.axeIndex) {
    return 1;
  }
  return 0;
}
