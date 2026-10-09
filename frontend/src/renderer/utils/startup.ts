import { DataGridPlotToSave, URIData } from '../types';

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

/**
 * Data entries opened from the command line, named after their position
 * (URI-0, URI-1, ...) so that they fill a template's slots in order. A URI
 * that does not exist is left out without shifting the names of the others.
 */
export const startupDataURI = (
  uris: string[],
  exists: boolean[],
  pickColor: () => string,
): URIData[] =>
  uris.flatMap((uri, index) =>
    exists[index] ? [{ name: `URI-${index}`, uri, uriColor: pickColor() }] : [],
  );

/**
 * Data entry labels a template's plots refer to that `dataURI` does not
 * provide.
 */
export const missingTemplateLabels = (
  dataPlot: DataGridPlotToSave[],
  dataURI: URIData[],
): string[] => {
  const labels = new Set(
    dataPlot.flatMap((grid) => grid.plot.map((plot) => plot.labelUri)),
  );
  return [...labels]
    .filter((label) => !dataURI.some((uri) => uri.name === label))
    .sort();
};
