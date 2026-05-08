import { Complex } from '../types';

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
