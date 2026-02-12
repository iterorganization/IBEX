import { Checkbox, Select, Stack } from '@mantine/core';
import { DataGridPlot, DataPlotly } from '../../../types';

interface CustomizeHeatmapProps {
  customizedDataGrid: DataGridPlot;
  selectedPlot: DataPlotly | null;
  applyToAllHeatmap: boolean;
  setCustomizedDataGrid: React.Dispatch<React.SetStateAction<DataGridPlot>>;
  setApplyToAllHeatmap: React.Dispatch<React.SetStateAction<boolean>>;
}
export const CustomizeHeatmap = ({
  customizedDataGrid,
  selectedPlot,
  applyToAllHeatmap,
  setCustomizedDataGrid,
  setApplyToAllHeatmap,
}: CustomizeHeatmapProps) => {
  const updateColorscale = (value: string) => {
    const updatedDataPlot = JSON.parse(
      JSON.stringify(customizedDataGrid),
    ) as DataGridPlot;

    if (applyToAllHeatmap) {
      for (const plot of updatedDataPlot.plot) {
        const updatedCustomPref = plot?.customPreferences || {};
        updatedCustomPref.colorscale = value;
        plot.customPreferences = updatedCustomPref;
      }
    } else {
      const updatedCustomPref = selectedPlot?.customPreferences || {};
      updatedCustomPref.colorscale = value;
      updatedDataPlot.plot.find(
        (plot) => plot.name === selectedPlot.name,
      ).customPreferences = updatedCustomPref;
    }

    setCustomizedDataGrid({
      ...customizedDataGrid,
      plot: updatedDataPlot.plot,
    });
  };

  return (
    <Stack>
      <Select
        label="Colorscale"
        description="Customize the colorscale"
        placeholder="Customize the colorscale"
        data={['Viridis', 'Cividis', 'RdBu', 'YlGnBu', 'YlOrRd']}
        value={selectedPlot?.customPreferences?.colorscale || 'Viridis'}
        onChange={(value) => updateColorscale(value)}
        maw={200}
      />
      <Checkbox
        checked={applyToAllHeatmap}
        onChange={(event) => setApplyToAllHeatmap(event.currentTarget.checked)}
        label="Apply to all plots"
      />
    </Stack>
  );
};
