import { AxisData, Complex } from '../types';

export function getColorRandom(): string {
  return `#${Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, '0')}`;
}

export function removeSuffix(str: string, suffix: string): string {
  return str?.endsWith(suffix) ? str.slice(0, -suffix.length) : str;
}

type AxisValue = number | string | Complex | AxisValue[];
/**
 * Functions returning true if data list contains at least a float
 * @param value : expect AxisData
 * @returns a boolean
 */
export function containsFloat(value: AxisValue): boolean {
  if (Array.isArray(value)) {
    return value.some(containsFloat);
  }

  return typeof value === 'number' && !Number.isInteger(value);
}

export function rgbToRgba(rgb: string, alpha: number): string {
  return rgb.replace('rgb', 'rgba').replace(')', `, ${alpha})`);
}

/**
 * Replace recursively all `null` or `undefined` by `NaN`.
 * Works for AxisData of dimension 1D, 2D or 3D.
 *
 * @param arr - Array which could contain nulls or undefined
 * @returns New array with NaN instead of null/undefined
 */
export function replaceNullsWithNaN(arr: AxisData): AxisData {
  if (Array.isArray(arr)) {
    /* eslint-disable  @typescript-eslint/no-explicit-any */
    return arr.map((v: any) => {
      return Array.isArray(v) ? replaceNullsWithNaN(v as AxisData) : (v ?? NaN);
    }) as AxisData;
  }

  // 1D Case
  return arr ?? NaN;
}
