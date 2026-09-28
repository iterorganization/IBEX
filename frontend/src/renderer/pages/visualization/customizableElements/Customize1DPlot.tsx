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
import { initPlotColors } from '../../../utils';

interface Customize1DPlotProps {
  customizedDataGrid: DataGridPlot;
  selectedPlot: DataPlotly | null;
  customContainerRef: React.MutableRefObject<HTMLDivElement>;
  setCustomizedDataGrid: React.Dispatch<React.SetStateAction<DataGridPlot>>;
}
export const Customize1DPlot = ({
  customizedDataGrid,
  selectedPlot,
  customContainerRef,
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
    // An undefined colour is what "no colour" has always meant here: it lets
    // Plotly pick the default, and `initPlotColors` reads it back from the DOM.
    const updatedPlots = customizedDataGrid.plot.map((plot) =>
      plot?.line?.color
        ? ({ ...plot, line: { ...plot.line, color: undefined } } as DataPlotly)
        : plot,
    );

    setColorPlot('');
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
      initPlotColors(
        customizedDataGrid,
        customContainerRef,
        setCustomizedDataGrid,
      );
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
          value={colorPlot}
          onChange={(value) => updatePlotColor(value)}
        />
        <Tooltip label="Reset color of each plot" position="bottom-start">
          <Button variant="outline" onClick={resetPlotColors}>
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
