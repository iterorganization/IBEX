/**
 * Why `name` cannot name a configuration, or null when it can.
 * @param name The name typed by the user
 * @param takenNames The names of the other open configurations
 */
export const configurationNameError = (
  name: string,
  takenNames: string[],
): string | null =>
  !name.trim()
    ? 'This field is required'
    : takenNames.includes(name)
      ? 'This name is already taken'
      : null;

/**
 * First of `base`, `base-1`, `base-2`, ... that no open configuration uses.
 */
export const uniqueConfigurationName = (
  base: string,
  takenNames: string[],
): string => {
  let name = base;
  for (let i = 1; takenNames.includes(name); i++) {
    name = `${base}-${i}`;
  }
  return name;
};
