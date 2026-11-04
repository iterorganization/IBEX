import { DataGridPlot, DataPlotly } from '../../types';
import { Stack, Text } from '@mantine/core';
import { axisVector, lineVector } from '../../derive/vectors';

interface NoDataForURIProps {
  itemDataGrid: DataGridPlot;
  selectedPlot?: DataPlotly;
}

export const NoDataForURI = ({
  itemDataGrid,
  selectedPlot,
}: NoDataForURIProps) => {
  const coordinates = itemDataGrid.coordinates ?? [];
  const x = axisVector(coordinates, 0);
  /** Nothing to draw: no axis, no row, and no payload to derive either from. */
  const isEmpty = (plot: DataPlotly) =>
    !x?.length &&
    !lineVector(plot.yData, coordinates)?.length &&
    !plot.yData?.length;

  return (
    <Stack gap={0}>
      <Text>No data found for:</Text>
      {selectedPlot // For selected plot from tab
        ? isEmpty(selectedPlot) && (
            <Text>{`- '${selectedPlot.labelUri}' with path '${selectedPlot.nodeUri.split('#')[1]}'`}</Text>
          )
        : // Each plots
          itemDataGrid.plot.map(
            (unplottablePlot, index) =>
              isEmpty(unplottablePlot) && (
                <Text
                  key={`no_data_line_${index}`}
                >{`- '${unplottablePlot.labelUri}' with path '${unplottablePlot.nodeUri.split('#')[1]}'`}</Text>
              ),
          )}
    </Stack>
  );
};
