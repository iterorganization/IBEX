import { useEffect, useState } from 'react';
import { DataGridPlot, DataPlotly, UnaryOperation } from '../../../types';
import {
  buildSmoothingRequest,
  fetchDataPlot,
  formatOperations,
  getArrayValueFromDependance,
  getFirstArrayValueFromShape,
  getOperationMethods,
  getUrisToInterpolate,
  getVectorData,
  normalizeIndices,
  reapplyAxisOrder,
} from '../../../utils';
import { showNotification } from '@mantine/notifications';
import {
  ActionIcon,
  Button,
  Group,
  NumberInput,
  Select,
  Stack,
} from '@mantine/core';
import { IconMinus, IconPlus, IconRestore } from '@tabler/icons-react';

const EMPTY_OPERATION: UnaryOperation = { type: null, value: 1 };

interface CustomizeUnaryOperationsProps {
  customizedDataGrid: DataGridPlot;
  selectedPlot: DataPlotly | null;
  setCustomizedDataGrid: React.Dispatch<React.SetStateAction<DataGridPlot>>;
}
export const CustomizeUnaryOperations = ({
  customizedDataGrid,
  selectedPlot,
  setCustomizedDataGrid,
}: CustomizeUnaryOperationsProps) => {
  const [operationMethods, setOperationMethods] = useState<
    { value: string; label: string }[]
  >([]);
  const [loadingAction, setLoadingAction] = useState<
    'apply' | 'restore' | null
  >(null);

  // Source of truth is the selected plot's own operations (persisted on the grid)
  const operations = selectedPlot?.operations ?? [{ ...EMPTY_OPERATION }];

  /**
   * Persist the operations rows onto the selected plot
   */
  const updateOperations = (next: UnaryOperation[]) => {
    if (!selectedPlot) return;
    const updated = structuredClone(customizedDataGrid) as DataGridPlot;
    const plot = updated.plot.find((p) => p.name === selectedPlot.name);
    if (plot) {
      plot.operations = next;
    }
    setCustomizedDataGrid({ ...customizedDataGrid, plot: updated.plot });
  };

  const addOperation = () => {
    updateOperations([...operations, { ...EMPTY_OPERATION }]);
  };

  const removeOperation = (index: number) => {
    updateOperations(operations.filter((_, i) => i !== index));
  };

  const updateOperationType = (index: number, type: string | null) => {
    updateOperations(
      operations.map((operation, i) =>
        i === index ? { ...operation, type } : operation,
      ),
    );
  };

  const updateOperationValue = (index: number, value: number) => {
    updateOperations(
      operations.map((operation, i) =>
        i === index ? { ...operation, value } : operation,
      ),
    );
  };

  /**
   * Re-fetch the selected plot's data (optionally with operations) and update it.
   * Called with operations to apply them, or without to restore raw data.
   */
  const updatePlotsData = async (
    action: 'apply' | 'restore',
    operationsList?: string[],
  ) => {
    if (!selectedPlot) return;
    try {
      setLoadingAction(action);
      const updatedDataPlot = structuredClone(
        customizedDataGrid,
      ) as DataGridPlot;

      const plot = updatedDataPlot.plot.find(
        (p) => p.name === selectedPlot.name,
      );
      if (!plot) return;

      const urisToInterpolate = getUrisToInterpolate(
        plot.nodeUri,
        updatedDataPlot.plot,
      );
      const dataPlotOperated = await fetchDataPlot(
        normalizeIndices(plot.nodeUri),
        customizedDataGrid?.downsampled_method,
        customizedDataGrid?.downsampled_size,
        updatedDataPlot?.dataType,
        urisToInterpolate,
        customizedDataGrid?.interpolated_method,
        buildSmoothingRequest(plot.smoothing),
        operationsList,
      );

      // Realign coordinates with the returned data (a no-op when the operations
      // preserve the shape; needed if the fetch auto-downsampled the data)
      let coordinateIndex = 0;
      for (const coordinate of updatedDataPlot.coordinates) {
        coordinate.shape =
          dataPlotOperated.data.coordinates[coordinateIndex].downsampled_shape;
        coordinate.data =
          dataPlotOperated.data.coordinates[coordinateIndex].value;
        coordinateIndex++;
        coordinate.range = [
          0,
          coordinate.shape[coordinate.shape.length - 1] - 1,
        ];
        const firstArrayValueFromCoord = getFirstArrayValueFromShape(
          coordinate.data,
          coordinate.shape,
        );
        coordinate.rangeValues = [
          firstArrayValueFromCoord[0],
          firstArrayValueFromCoord[firstArrayValueFromCoord.length - 1],
        ];
      }

      // Update only the selected plot with the new data
      plot.shape = dataPlotOperated.data.downsampled_shape;
      plot.x = getArrayValueFromDependance(updatedDataPlot.coordinates, 0);
      plot.yData = dataPlotOperated.data.value;
      plot.y = getVectorData(updatedDataPlot.coordinates, plot.yData);
      if (action === 'restore') {
        plot.operations = undefined;
      }

      // Re-apply axis transposition on the re-fetched plot only: the back-end
      // returns data in default axis order, so restore the user's transposition
      const wantedAxeIndexOrder = customizedDataGrid.coordinates.map(
        (coord) => coord.axeIndex,
      );
      await reapplyAxisOrder(updatedDataPlot, wantedAxeIndexOrder, plot);

      setCustomizedDataGrid({
        ...customizedDataGrid,
        coordinates: updatedDataPlot.coordinates,
        plot: updatedDataPlot.plot,
      });
    } catch (error) {
      console.error('Error getting plot data: ', error);
      showNotification({
        title: 'Error',
        message: `Unable to get plot data.`,
        color: 'red',
      });
    } finally {
      setLoadingAction(null);
    }
  };

  /**
   * Apply the operations to the selected plot
   */
  const applyOperations = async () => {
    const operationsList = formatOperations(operations);
    if (!operationsList.length) {
      showNotification({
        title: 'No operation',
        message: 'Please add at least one operation.',
        color: 'red',
      });
      return;
    }
    await updatePlotsData('apply', operationsList);
  };

  /**
   * Restore the selected plot by re-fetching it without operations
   */
  const restoreData = async () => {
    await updatePlotsData('restore');
  };

  /*
   * Get operation methods to show in select
   */
  useEffect(() => {
    const getOperationList = async () => {
      const options = await getOperationMethods();
      setOperationMethods(options);
    };
    getOperationList();
  }, []);

  return (
    <Stack w="fit-content">
      {operations.map((operation, index) => (
        <Group key={index} align="flex-end" justify="space-between">
          <Select
            label="Operation"
            description="Select the operation"
            placeholder="Select the operation"
            value={operation.type}
            data={operationMethods}
            onChange={(value) => updateOperationType(index, value)}
            w="45%"
            maw={200}
          />
          <NumberInput
            label="Value"
            description="Scalar value for the operation"
            placeholder="Update the value"
            value={operation.value}
            onChange={(value: number) => updateOperationValue(index, value)}
            w="45%"
            maw={200}
          />
          {operations.length !== 1 && (
            <ActionIcon
              variant="transparent"
              color="red"
              onClick={() => removeOperation(index)}
              aria-label="Remove operation"
              size={36}
            >
              <IconMinus size={20} />
            </ActionIcon>
          )}
        </Group>
      ))}

      <Group justify="flex-start">
        <Button
          variant="subtle"
          leftSection={<IconPlus size={16} />}
          onClick={addOperation}
        >
          Add operation
        </Button>
      </Group>

      <Group justify="center">
        <Button
          onClick={applyOperations}
          loading={loadingAction === 'apply'}
          disabled={!selectedPlot || loadingAction === 'restore'}
        >
          Apply
        </Button>
        <Button
          onClick={restoreData}
          loading={loadingAction === 'restore'}
          disabled={!selectedPlot || loadingAction === 'apply'}
          variant="outline"
          leftSection={<IconRestore size={20} />}
        >
          Restore
        </Button>
      </Group>
    </Stack>
  );
};
