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

interface Customize1DPlotProps {
  customizedDataGrid: DataGridPlot;
  selectedPlot: DataPlotly | null;
  setCustomizedDataGrid: React.Dispatch<React.SetStateAction<DataGridPlot>>;
  initPlotColors: () => void;
}
export const Customize1DPlot = ({
  customizedDataGrid,
  selectedPlot,
  setCustomizedDataGrid,
  initPlotColors,
}: Customize1DPlotProps) => {
  const [colorPlot, setColorPlot] = useState(selectedPlot?.line?.color || '');

  const updatePlotColor = (newColor: string) => {
    const updatedDataPlot = JSON.parse(
      JSON.stringify(customizedDataGrid),
    ) as DataGridPlot;

    const updatedLine = selectedPlot?.line || {};
    updatedLine.color = newColor;
    updatedDataPlot.plot.find((plot) => plot.name === selectedPlot.name).line =
      updatedLine;

    setCustomizedDataGrid({
      ...customizedDataGrid,
      plot: updatedDataPlot.plot,
    });
    setColorPlot(newColor);
  };

  const resetPlotColors = () => {
    const updatedPlots = JSON.parse(JSON.stringify(customizedDataGrid.plot));
    for (const plot of updatedPlots) {
      if (plot?.line?.color) {
        delete plot.line.color;
      }
    }

    setColorPlot('');
    setCustomizedDataGrid({ ...customizedDataGrid, plot: updatedPlots });
  };

  const updatePlotMode = (newMode: string) => {
    const updatedDataPlot = JSON.parse(
      JSON.stringify(customizedDataGrid),
    ) as DataGridPlot;

    updatedDataPlot.plot.find((plot) => plot.name === selectedPlot.name).mode =
      newMode;

    setCustomizedDataGrid({
      ...customizedDataGrid,
      plot: updatedDataPlot.plot,
    });
  };

  const updatePlotShape = (newShape: string) => {
    const updatedDataPlot = JSON.parse(
      JSON.stringify(customizedDataGrid),
    ) as DataGridPlot;

    const plotToUpdate = updatedDataPlot.plot.find(
      (plot) => plot.name === selectedPlot.name,
    );
    plotToUpdate.line = { ...plotToUpdate?.line, shape: newShape };

    setCustomizedDataGrid({
      ...customizedDataGrid,
      plot: updatedDataPlot.plot,
    });
  };

  useEffect(() => {
    if (selectedPlot?.line?.color) {
      // Init color plot in component
      setColorPlot(selectedPlot.line.color);
    } else {
      initPlotColors();
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
