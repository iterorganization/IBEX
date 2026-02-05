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
    const minRangeValue = coordinate?.rangeValues
      ? coordinate.rangeValues[0]
      : coordVector[0];
    const maxRangeValue = coordinate?.rangeValues
      ? coordinate.rangeValues[1]
      : coordVector[coordVector.length - 1];
    const [typedMinRange, setTypedMinRange] = useState(minRangeValue);
    const [typedMaxRange, setTypedMaxRange] = useState(maxRangeValue);
    const [isLoadingApply, setIsLoadingApply] = useState(false);
    const [isLoadingRestore, setIsLoadingRestore] = useState(false);

    const handleApplyRange = async (
      coordinateToApply: Coordinates,
      newValueRange: [number, number] | [string, string],
      customizedDataGrid: DataGridPlot,
      newPlotsUri?: string[],
      shouldApplyRangeOriginInCoord?: boolean,
    ) => {
      if (!newValueRange) {
        return;
      }

      if (coordinate.name === coordinateToApply.name) {
        // Ensure min and max typed have the expected type (we force to 0 if numbers aren't)
        if (typeof minRangeValue !== typeof newValueRange[0]) {
          newValueRange[0] = 0;
        }
        if (typeof maxRangeValue !== typeof newValueRange[1]) {
          newValueRange[1] = 0;
        }
      }

      // Sort value range inputs
      if (typeof newValueRange[0] === 'number') {
        (newValueRange as [number, number]).sort((a, b) => a - b);
      } else {
        const coordVector = getArrayValueFromDependance(
          customizedDataGrid.coordinates,
          coordinateToApply.axeIndex,
        );
        const firstIndex = coordVector.findIndex(
          (value) => value === newValueRange[0],
        );
        const secondIndex = coordVector.findIndex(
          (value) => value === newValueRange[1],
        );
        if (
          firstIndex !== -1 &&
          secondIndex !== -1 &&
          firstIndex > secondIndex
        ) {
          const temp = newValueRange[0];
          newValueRange[0] = newValueRange[1];
          newValueRange[1] = temp;
        }
      }

      // Check old range to restore data if needed
      setIsLoadingApply(true);

      if (
        // Check if numbers min or max are out of actual range
        (coordinateToApply?.rangeValues &&
          typeof newValueRange[0] === 'number' &&
          ((newValueRange[0] as number) <
            (coordinateToApply.rangeValues[0] as number) ||
            newValueRange[1] > coordinateToApply.rangeValues[1])) ||
        // Check if strings min or max are not included in actual range
        (coordinateToApply?.rangeValues && typeof newValueRange[0] === 'string')
      ) {
        // Restore automatically range before applying new range if types range is out of actual range
        const appliedRange = await handleRestoreAndApply(
          newValueRange,
          newPlotsUri,
          shouldApplyRangeOriginInCoord,
        );
        setCustomizedDataGrid(appliedRange);
      } else {
        const appliedRange = await applyRange(
          coordinateToApply,
          newValueRange,
          customizedDataGrid,
          newPlotsUri,
          undefined,
          shouldApplyRangeOriginInCoord,
        );
        setCustomizedDataGrid(appliedRange);
      }
      setIsLoadingApply(false);
    };

    const handleRestoreRange = async () => {
      setIsLoadingRestore(true);
      await restoreRange();
      setIsLoadingRestore(false);
    };

    const handleRestoreAndApply = async (
      newValueRange: [number, number] | [string, string],
      newPlotsUri: string[],
      shouldApplyRangeOriginInCoord: boolean,
    ) => {
      const restoredDataGrid = await restoreRange();
      const restoredCoordinate = restoredDataGrid.coordinates.find(
        (coord) => coord.axeIndex === coordinate.axeIndex,
      );

      const appliedRange = await applyRange(
        restoredCoordinate,
        newValueRange,
        restoredDataGrid,
        newPlotsUri,
        undefined,
        shouldApplyRangeOriginInCoord,
      );
      return appliedRange;
    };

    const restoreRange = async () => {
      try {
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

        const newCustomizedDataGrid = {
          ...customizedDataGrid,
          coordinates: updatedDataPlot.coordinates,
          plot: updatedDataPlot.plot,
        } as DataGridPlot;
        setCustomizedDataGrid(newCustomizedDataGrid);
        return newCustomizedDataGrid;
      } catch (error) {
        console.error('Error restoring the range: ', error);
      }
    };

    return (
      <Group align="flex-end">
        <Group align="flex-end" justify="space-between">
          {typeof minRangeValue === 'number' ? (
            <>
              <NumberInput
                label="Min"
                description="Update the min range"
                placeholder="Update the min range"
                value={typedMinRange}
                onChange={(value: number) => setTypedMinRange(value)}
                w={150}
                hideControls
              />
              <NumberInput
                label="Max"
                description="Update the max range"
                placeholder="Update the max range"
                value={typedMaxRange}
                onChange={(value: number) => setTypedMaxRange(value)}
                w={150}
                hideControls
              />
            </>
          ) : (
            <>
              <TextInput
                label="Min"
                description="Update the min range"
                placeholder="Update the min range"
                value={typedMinRange}
                onChange={(event) =>
                  setTypedMinRange(event.currentTarget.value)
                }
                w={150}
              />
              <TextInput
                label="Max"
                description="Update the max range"
                placeholder="Update the max range"
                value={typedMaxRange}
                onChange={(event) =>
                  setTypedMaxRange(event.currentTarget.value)
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
                [typedMinRange, typedMaxRange] as
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
            onClick={handleRestoreRange}
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
