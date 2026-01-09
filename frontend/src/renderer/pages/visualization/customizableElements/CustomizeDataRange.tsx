import { useCallback, useState } from 'react';
import { AxisData, Coordinates, DataGridPlot } from '../../../types';
import {
  fetchDataPlot,
  getArrayValueFromDependance,
  getFirstArrayValueFromShape,
  getVectorData,
  normalizeIndices,
  getTensorizedMatrix,
  fetchErrorBands,
  applyRange,
} from '../../../utils';
import { Button, Divider, Group, NumberInput, Stack } from '@mantine/core';
import { IconCheck, IconRestore } from '@tabler/icons-react';

interface CustomizeDataRangeProps {
  customizedDataGrid: DataGridPlot;
  setCustomizedDataGrid: React.Dispatch<React.SetStateAction<DataGridPlot>>;
}
export const CustomizeDataRange = ({
  customizedDataGrid,
  setCustomizedDataGrid,
}: CustomizeDataRangeProps) => {
  interface CoordinateRangeProps {
    coordinate: Coordinates;
  }
  const CoordinateRange = ({ coordinate }: CoordinateRangeProps) => {
    const minRange = coordinate?.range ? coordinate.range[0] : 0;
    const maxRange = coordinate?.range
      ? coordinate.range[1]
      : typeof coordinate.shape !== 'string'
        ? coordinate.shape[coordinate.shape.length - 1] - 1
        : getFirstArrayValueFromShape(coordinate.data, coordinate.shape)
            .length - 1;
    const [dataRangeMin, setDataRangeMin] = useState<number>(minRange);
    const [dataRangeMax, setDataRangeMax] = useState<number>(maxRange);
    const [isLoadingApply, setIsLoadingApply] = useState(false);
    const [isLoadingRestore, setIsLoadingRestore] = useState(false);

    const handleApplyRange = async (
      coordinate: Coordinates,
      newRange: [number, number],
      customizedDataGrid: DataGridPlot,
      newPlotsUri?: string[],
    ) => {
      if (!newRange) {
        return;
      }
      setIsLoadingApply(true);
      const appliedRange = await applyRange(
        coordinate,
        newRange,
        customizedDataGrid,
        newPlotsUri,
      );
      setCustomizedDataGrid(appliedRange);
      setIsLoadingApply(false);
    };

    const restoreRange = async () => {
      try {
        setIsLoadingRestore(true);
        const updatedDataPlot = JSON.parse(
          JSON.stringify(customizedDataGrid),
        ) as DataGridPlot;
        const updatedCoord = updatedDataPlot.coordinates.find(
          (coord) => coord.axeIndex === coordinate.axeIndex,
        );
        // Step 1 => get full original data (coordinates + plots) && applyRange in coordinates having range (not main range since we'll delete it)
        let plotIndex = 0;
        for (const plot of updatedDataPlot.plot) {
          // Get original data for each plot
          const dataRestored = await fetchDataPlot(
            normalizeIndices(plot.nodeUri),
            updatedDataPlot?.downsampled_method,
            updatedDataPlot?.downsampled_size,
          );

          if (plot.error_y?.type === 'data' && plot.error_y?.array.length > 0) {
            // Downsample restored error bands with latest parameters used if error bands exists for this plot
            await fetchErrorBands(updatedDataPlot, plot.nodeUri);
          }

          if (plotIndex === 0) {
            // Update coordinates (their shape & data) only once because each plots have same coordinates
            let coordinateIndex = 0;
            for (const coordinate of updatedDataPlot.coordinates) {
              // Reset coordinates
              coordinate.shape =
                dataRestored.data.coordinates[
                  coordinateIndex
                ].downsampled_shape;
              coordinate.data =
                dataRestored.data.coordinates[coordinateIndex].value;
              coordinateIndex++;
            }
          }

          // Update plot with downsampled data
          plot.shape = dataRestored.data.downsampled_shape;
          // Get x axis switch coordinates dependances
          plot.x = getArrayValueFromDependance(updatedDataPlot.coordinates, 0);
          plot.yData = dataRestored.data.value;
          // Get y axis
          const vectorData = getVectorData(
            updatedDataPlot.coordinates,
            plot.yData,
          );
          plot.y = vectorData;

          plotIndex++;
        }

        // Apply ranges
        for (const coord of updatedDataPlot.coordinates) {
          // Get full range
          const dataTensorized = await getTensorizedMatrix(coord.data);
          coord.shape = dataTensorized.shape;
          coord.data = (await dataTensorized.array()) as AxisData;
        }

        delete updatedCoord.range;
        for (const coord of updatedDataPlot.coordinates) {
          if (coordinate.name !== coord.name) {
            const tensorizedMatrix = await getTensorizedMatrix(coord.data);
            const forcedRange = coord?.range || [
              0,
              tensorizedMatrix.shape[tensorizedMatrix.shape.length - 1] - 1,
            ];
            await handleApplyRange(coord, forcedRange, updatedDataPlot, [
              ...updatedDataPlot.plot.map((plot) => plot.nodeUri),
            ]);
          }
        }

        setCustomizedDataGrid({
          ...customizedDataGrid,
          coordinates: updatedDataPlot.coordinates,
          plot: updatedDataPlot.plot,
        });
      } catch (error) {
        console.error('Error restoring the range: ', error);
      } finally {
        setIsLoadingRestore(false);
      }
    };

    const setInDataRange = useCallback(
      (
        rangePosition: 'min' | 'max',
        value: number,
        setter: React.Dispatch<React.SetStateAction<number>>,
      ) => {
        let checkedValue = value;
        if (checkedValue < minRange) {
          checkedValue = minRange;
        } else if (checkedValue > maxRange) {
          checkedValue = maxRange;
        }

        if (rangePosition === 'min') {
          if (checkedValue > dataRangeMax) {
            checkedValue = dataRangeMax;
          }
        } else {
          if (checkedValue < dataRangeMin) {
            checkedValue = dataRangeMin;
          }
        }
        setter(checkedValue);
      },
      [minRange, maxRange, dataRangeMin, dataRangeMax],
    );

    return (
      <Group align="flex-end">
        <Group align="flex-end" justify="space-between">
          <NumberInput
            label="Min"
            description="Update the min range"
            placeholder="Update the min range"
            value={dataRangeMin}
            min={coordinate?.range ? coordinate.range[0] : 0}
            max={maxRange}
            onChange={(value: number) =>
              setInDataRange('min', value, setDataRangeMin)
            }
            w={150}
          />
          <NumberInput
            label="Max"
            description="Update the max range"
            placeholder="Update the max range"
            value={dataRangeMax}
            min={coordinate?.range ? coordinate.range[0] : 0}
            max={maxRange}
            onChange={(value: number) =>
              setInDataRange('max', value, setDataRangeMax)
            }
            w={150}
          />
        </Group>
        <Group align="flex-end" justify="space-between">
          <Button
            onClick={() =>
              handleApplyRange(
                coordinate,
                [dataRangeMin, dataRangeMax],
                customizedDataGrid,
              )
            }
            loading={isLoadingApply}
            leftSection={<IconCheck size={20} />}
          >
            Apply
          </Button>
          <Button
            onClick={restoreRange}
            disabled={!coordinate?.range}
            loading={isLoadingRestore}
            variant="outline"
            leftSection={<IconRestore size={20} />}
          >
            Restore
          </Button>
        </Group>
      </Group>
    );
  };

  return (
    <Stack>
      {customizedDataGrid.coordinates.map((coord, index) => (
        <Stack key={`coord_data_range_${index}`}>
          <Divider label={coord.name} labelPosition="center" />
          <CoordinateRange coordinate={coord} />
        </Stack>
      ))}
    </Stack>
  );
};
