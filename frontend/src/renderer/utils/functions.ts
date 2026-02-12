export function removeSuffix(str: string, suffix: string): string {
  return str?.endsWith(suffix) ? str.slice(0, -suffix.length) : str;
}

type AxisValue = number | string | AxisValue[];
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
