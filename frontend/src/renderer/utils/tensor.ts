// Relative, not the `src/*` alias: this module is reachable from the code
// `npm run test:unit` loads, and ts-node does not resolve that alias without
// `tsconfig-paths/register`.
import * as tf from '@tensorflow/tfjs';
import { AxisData } from '../types';

/**
 * Turning the nested arrays the backend sends into a tensor.
 *
 * These live apart from `plot.ts` so that the derivation layer can tensorise a
 * payload without importing the transforms that call it.
 */

/**
 * Find the maximum shape of a potentially irregular array.
 */
/* eslint-disable  @typescript-eslint/no-explicit-any */
export function getMaxShape(arr: any[]): number[] {
  const shape: number[] = [];

  function goThrough(node: any, depth: number) {
    if (!Array.isArray(node)) return;

    // Update max shape to this length
    shape[depth] = Math.max(shape[depth] ?? 0, node.length);

    for (const item of node) {
      goThrough(item, depth + 1);
    }
  }

  goThrough(arr, 0);
  return shape;
}

/**
 * Recursively fills an irregular array with NaN
 * to match a given shape.
 */
export function reshapeMatrix(arr: any[], shape: number[], depth = 0): any[] {
  const size = shape[depth];
  const result = [...arr];

  for (let i = 0; i < size; i++) {
    if (result[i] === undefined) {
      // If an element is missing, either NaN or a subarray filled with NaN is inserted
      if (shape.length > depth + 1) {
        result[i] = reshapeMatrix([], shape, depth + 1);
      } else {
        result[i] = NaN;
      }
    } else if (Array.isArray(result[i])) {
      result[i] = reshapeMatrix(result[i], shape, depth + 1);
    }
  }

  return result;
}

/**
 * Return a tensorized matrix using tensorflow
 * @param matrix
 * @returns
 */
export const getTensorizedMatrix = async (matrix: AxisData) => {
  const shape = getMaxShape(matrix);
  const reshapedMatrix = reshapeMatrix(matrix, shape);
  const dataTensorized = tf.tensor(reshapedMatrix);
  return dataTensorized;
};
