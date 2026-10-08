import {
  ColorInput,
  Group,
  Stack,
  Button,
  Tooltip,
  Select,
} from '@mantine/core';
import { DataGridPlot, DataPlotly } from '../../../types';
import { useEffect, useState } from 'react';
import { initPlotColors, withDefaultColors } from '../../../utils';

interface Customize1DPlotProps {
  customizedDataGrid: DataGridPlot;
  selectedPlot: DataPlotly | null;
  setCustomizedDataGrid: React.Dispatch<React.SetStateAction<DataGridPlot>>;
}
export const Customize1DPlot = ({
  customizedDataGrid,
  selectedPlot,
  setCustomizedDataGrid,
}: Customize1DPlotProps) => {
  const [colorPlot, setColorPlot] = useState(selectedPlot?.line?.color || '');

  /**
   * The grid's traces with the selected one replaced by `update(it)`. Only the
   * edited trace is a new object; the others, and every payload, are shared -
   * a colour change used to deep-copy every matrix in the grid.
   */
  const updateSelectedPlot = (update: (plot: DataPlotly) => DataPlotly) =>
    customizedDataGrid.plot.map((plot) =>
      plot.name === selectedPlot.name ? update(plot) : plot,
    );

  const updatePlotColor = (newColor: string) => {
    setCustomizedDataGrid({
      ...customizedDataGrid,
      plot: updateSelectedPlot(
        (plot) =>
          ({ ...plot, line: { ...plot.line, color: newColor } }) as DataPlotly,
      ),
    });
    setColorPlot(newColor);
  };

  const resetPlotColors = () => {
    // Every trace back to the palette, in trace order, so no two share a colour.
    const updatedPlots = withDefaultColors(
      customizedDataGrid.plot.map(
        (plot) =>
          ({ ...plot, line: { ...plot.line, color: undefined } }) as DataPlotly,
      ),
    );

    setColorPlot(
      updatedPlots.find((plot) => plot.name === selectedPlot?.name)?.line
        ?.color || '',
    );
    setCustomizedDataGrid({ ...customizedDataGrid, plot: updatedPlots });
  };

  const updatePlotMode = (newMode: string) => {
    setCustomizedDataGrid({
      ...customizedDataGrid,
      plot: updateSelectedPlot(
        (plot) => ({ ...plot, mode: newMode }) as DataPlotly,
      ),
    });
  };

  const updatePlotShape = (newShape: string) => {
    setCustomizedDataGrid({
      ...customizedDataGrid,
      plot: updateSelectedPlot(
        (plot) =>
          ({ ...plot, line: { ...plot.line, shape: newShape } }) as DataPlotly,
      ),
    });
  };

  useEffect(() => {
    if (selectedPlot?.line?.color) {
      // Init color plot in component
      setColorPlot(selectedPlot.line.color);
    } else {
      initPlotColors(customizedDataGrid, setCustomizedDataGrid);
    }
  }, [selectedPlot?.line]);

  return (
    <Stack>
      <Group align="flex-end">
        <ColorInput
          label="Plot color"
          description="Customize the plot color"
          placeholder="Customize the plot color"
          format="rgb"
          data-testid="plot-color-input"
          value={colorPlot}
          onChange={(value) => updatePlotColor(value)}
        />
        <Tooltip label="Reset color of each plot" position="bottom-start">
          <Button
            variant="outline"
            data-testid="plot-colors-reset-button"
            onClick={resetPlotColors}
          >
            Reset plot colors
          </Button>
        </Tooltip>
      </Group>

      <Select
        label="Plot mode"
        description="Customize the mode"
        placeholder="Customize the mode"
        data={['lines', 'lines+markers', 'markers']}
        value={selectedPlot?.mode || 'lines'}
        onChange={(value) => updatePlotMode(value)}
        maw={200}
      />

      <Select
        label="Plot shape"
        description="Customize the shape"
        placeholder="Customize the shape"
        data={[
          { value: 'linear', label: 'linear' },
          { value: 'hv', label: 'hv (Horizontal-Vertical)' },
        ]}
        value={selectedPlot?.line?.shape || 'linear'}
        onChange={(value) => updatePlotShape(value)}
        maw={200}
      />
    </Stack>
  );
};
