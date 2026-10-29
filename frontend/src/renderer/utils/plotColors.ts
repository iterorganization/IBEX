import { DataPlotly } from '../types';

/**
 * Plotly's default colorway, in the `rgb()` form the colour input writes and
 * `rgbToRgba` reads.
 */
export const defaultColorsRGB = [
  'rgb(31, 119, 180)',
  'rgb(255, 127, 14)',
  'rgb(44, 160, 44)',
  'rgb(214, 39, 40)',
  'rgb(148, 103, 189)',
  'rgb(140, 86, 75)',
  'rgb(227, 119, 194)',
  'rgb(127, 127, 127)',
  'rgb(188, 189, 34)',
  'rgb(23, 190, 207)',
];

const normalizeColor = (color: string) =>
  color.toLowerCase().replace(/\s+/g, '');

/**
 * The default colour for a trace added next to traces of `usedColors`: the
 * first palette colour none of them has, or once all are taken the least used
 * one (earliest in the palette on a tie), so repeats stay evenly spread.
 *
 * Plotly's own default picks by trace index, which hands a re-added trace the
 * colour of whichever trace now holds that index.
 */
export const nextDefaultColor = (
  usedColors: (string | undefined)[],
): string => {
  const counts = new Map<string, number>();
  for (const color of usedColors) {
    if (!color) continue;
    const key = normalizeColor(color);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  let best = defaultColorsRGB[0];
  let bestCount = Infinity;
  for (const color of defaultColorsRGB) {
    const count = counts.get(normalizeColor(color)) ?? 0;
    if (count < bestCount) {
      best = color;
      bestCount = count;
    }
  }
  return best;
};

/**
 * `plots` with a default colour on every trace that has none, chosen in order
 * against the colours already present. Traces with a colour are returned as
 * they are; the others are new objects.
 */
export const withDefaultColors = (plots: DataPlotly[]): DataPlotly[] => {
  const used = plots.map((plot) => plot.line?.color);
  return plots.map((plot, index) => {
    if (plot.line?.color) return plot;
    const color = nextDefaultColor(used);
    used[index] = color;
    return { ...plot, line: { ...plot.line, color } } as DataPlotly;
  });
};
