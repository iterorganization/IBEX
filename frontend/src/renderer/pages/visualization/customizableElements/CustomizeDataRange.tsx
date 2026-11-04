import { useState } from 'react';
import { Coordinates, DataGridPlot } from '../../../types';
import {
  applyRange,
  getArrayValueFromDependance,
  restoreRangeInGrid,
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

      // A range is resolved against the full payload, never against the window
      // currently shown, so a range wider than the one applied needs no restore
      // first - it is the same operation as a narrower one.
      setIsLoadingApply(true);
      setCustomizedDataGrid(
        await applyRange(coordinateToApply, newValueRange, customizedDataGrid),
      );
      setIsLoadingApply(false);
    };

    const handleRestoreRange = async () => {
      setIsLoadingRestore(true);
      // No fetch: the full array is the base every window was cut from, and it
      // is still in the registry.
      setCustomizedDataGrid(
        await restoreRangeInGrid(coordinate, customizedDataGrid),
      );
      setIsLoadingRestore(false);
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
                data-testid={
                  coordinate.axeIndex === 0 ? 'data-range-min-input' : undefined
                }
              />
              <NumberInput
                label="Max"
                description="Update the max range"
                placeholder="Update the max range"
                value={typedMaxRange}
                onChange={(value: number) => setTypedMaxRange(value)}
                w={150}
                hideControls
                data-testid={
                  coordinate.axeIndex === 0 ? 'data-range-max-input' : undefined
                }
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
            data-testid={
              coordinate.axeIndex === 0 ? 'data-range-apply-input' : undefined
            }
          >
            Apply
          </Button>
          <Button
            onClick={handleRestoreRange}
            disabled={!coordinate?.range}
            loading={isLoadingRestore}
            variant="outline"
            leftSection={<IconRestore size={20} />}
            data-testid={
              coordinate.axeIndex === 0 ? 'data-range-restore-input' : undefined
            }
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
