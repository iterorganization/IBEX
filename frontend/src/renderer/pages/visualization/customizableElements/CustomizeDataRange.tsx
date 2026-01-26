import { useState } from 'react';
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
  updateIndexFieldName,
  getLastIndexedField,
  swapAxis,
} from '../../../utils';
import {
  Button,
  Divider,
  Group,
  NumberInput,
  Stack,
  TextInput,
} from '@mantine/core';
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
    const coordVector = getArrayValueFromDependance(
      customizedDataGrid.coordinates,
      coordinate.axeIndex,
    );
    const minValueRange = coordinate?.rangeValues
      ? coordinate.rangeValues[0]
      : coordVector[0];
    const maxValueRange = coordinate?.rangeValues
      ? coordinate.rangeValues[1]
      : coordVector[coordVector.length - 1];
    const [valueRangeMin, setValueRangeMin] = useState(minValueRange);
    const [valueRangeMax, setValueRangeMax] = useState(maxValueRange);
    const [isLoadingApply, setIsLoadingApply] = useState(false);
    const [isLoadingRestore, setIsLoadingRestore] = useState(false);

    const handleApplyRange = async (
      coordinate: Coordinates,
      newValueRange: [number, number] | [string, string],
      customizedDataGrid: DataGridPlot,
      newPlotsUri?: string[],
      shouldApplyRangeOriginInCoord?: boolean,
    ) => {
      if (!newValueRange) {
        return;
      }
      setIsLoadingApply(true);
      const appliedRange = await applyRange(
        coordinate,
        newValueRange,
        customizedDataGrid,
        newPlotsUri,
        undefined,
        shouldApplyRangeOriginInCoord,
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
              coordinate.axeIndex = coordinateIndex;
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

        // Apply swap axis if different from default
        const wantedAxeIndexOrder = customizedDataGrid.coordinates.map(
          (coord) => coord.axeIndex,
        );
        let actualAxeIndexOrder = (
          JSON.parse(
            JSON.stringify(updatedDataPlot.coordinates),
          ) as Coordinates[]
        ).map((coord) => coord.axeIndex);
        if (
          JSON.stringify(wantedAxeIndexOrder) !==
          JSON.stringify(actualAxeIndexOrder)
        ) {
          // Get transposed order
          let swappedDataPlot = JSON.parse(
            JSON.stringify(updatedDataPlot),
          ) as DataGridPlot;
          let index = 0;
          for (const wantedAxeIndex of wantedAxeIndexOrder) {
            if (wantedAxeIndex !== actualAxeIndexOrder[index]) {
              const newSwappedDataPlot = await swapAxis(
                swappedDataPlot,
                wantedAxeIndex,
                actualAxeIndexOrder[index],
              );
              actualAxeIndexOrder = newSwappedDataPlot.coordinates.map(
                (coord) => coord.axeIndex,
              );
              swappedDataPlot = newSwappedDataPlot;
            }
            index++;
          }
          updatedDataPlot.coordinates = swappedDataPlot.coordinates;
          updatedDataPlot.plot = swappedDataPlot.plot;
        }

        // Apply ranges
        const updatedCoord = updatedDataPlot.coordinates.find(
          (coord) => coord.axeIndex === coordinate.axeIndex,
        );
        const lastTargetLastName = getLastIndexedField(updatedCoord.target);
        for (const coord of updatedDataPlot.coordinates) {
          // Get full range
          const dataTensorized = await getTensorizedMatrix(coord.data);
          coord.shape = dataTensorized.shape;
          coord.data = (await dataTensorized.array()) as AxisData;

          // Update target & path with index 0
          const updatedPath = updateIndexFieldName(
            coord.path,
            lastTargetLastName,
            0,
          );
          const updatedTarget = updateIndexFieldName(
            coord.target,
            lastTargetLastName,
            0,
          );
          coord.path = updatedPath;
          coord.target = updatedTarget;
          if (coord.name === updatedCoord.name) {
            coord.valueIndex = 0;
          }
        }

        // delete range & rangeValues to apply full range
        delete updatedCoord.range;
        delete updatedCoord.rangeValues;

        for (const coord of updatedDataPlot.coordinates) {
          if (coordinate.name !== coord.name) {
            const tensorizedMatrix = await getTensorizedMatrix(coord.data);
            const forcedRangeValues = coord?.rangeValues || [
              getFirstArrayValueFromShape(
                coord.data,
                tensorizedMatrix.shape,
              )[0],
              getFirstArrayValueFromShape(coord.data, tensorizedMatrix.shape)[
                tensorizedMatrix.shape[tensorizedMatrix.shape.length - 1] - 1
              ],
            ];
            await handleApplyRange(
              coord,
              forcedRangeValues,
              updatedDataPlot,
              [...updatedDataPlot.plot.map((plot) => plot.nodeUri)],
              true,
            );
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

    return (
      <Group align="flex-end">
        <Group align="flex-end" justify="space-between">
          {typeof valueRangeMin === 'number' ? (
            <>
              <NumberInput
                label="Min"
                description="Update the min range"
                placeholder="Update the min range"
                value={valueRangeMin}
                onChange={(value: number) => setValueRangeMin(value)}
                w={150}
              />
              <NumberInput
                label="Max"
                description="Update the max range"
                placeholder="Update the max range"
                value={valueRangeMax}
                onChange={(value: number) => setValueRangeMax(value)}
                w={150}
              />
            </>
          ) : (
            <>
              <TextInput
                label="Min"
                description="Update the min range"
                placeholder="Update the min range"
                value={valueRangeMin}
                onChange={(event) =>
                  setValueRangeMin(event.currentTarget.value)
                }
                w={150}
              />
              <TextInput
                label="Max"
                description="Update the max range"
                placeholder="Update the max range"
                value={valueRangeMax}
                onChange={(event) =>
                  setValueRangeMax(event.currentTarget.value)
                }
                w={150}
              />
            </>
          )}
        </Group>
        <Group align="flex-end" justify="space-between">
          <Button
            onClick={async () =>
              handleApplyRange(
                coordinate,
                [valueRangeMin, valueRangeMax] as
                  | [number, number]
                  | [string, string],
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
