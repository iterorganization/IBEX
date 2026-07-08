import { useEffect, useState } from 'react';
import { DataGridPlot, UnaryOperation } from '../../../types';
import {
  fetchDataPlot,
  getArrayValueFromDependance,
  getFirstArrayValueFromShape,
  getOperationMethods,
  getUrisToInterpolate,
  getVectorData,
  normalizeIndices,
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
import { OptionWithTooltip } from '../../../types/components/select';
import { RenderSelectOption } from '../../../components/select';

const EMPTY_OPERATION: UnaryOperation = { type: null, value: 1 };

interface CustomizeUnaryOperationsProps {
  customizedDataGrid: DataGridPlot;
  setCustomizedDataGrid: React.Dispatch<React.SetStateAction<DataGridPlot>>;
}
export const CustomizeUnaryOperations = ({
  customizedDataGrid,
  setCustomizedDataGrid,
}: CustomizeUnaryOperationsProps) => {
  const [operationMethods, setOperationMethods] = useState<OptionWithTooltip[]>(
    [],
  );
  const [operations, setOperations] = useState<UnaryOperation[]>([
    { ...EMPTY_OPERATION },
  ]);
  const [loadingAction, setLoadingAction] = useState<
    'apply' | 'restore' | null
  >(null);

  const addOperation = () => {
    setOperations((prev) => [...prev, { ...EMPTY_OPERATION }]);
  };

  const removeOperation = (index: number) => {
    setOperations((prev) => prev.filter((_, i) => i !== index));
  };

  const updateOperationType = (index: number, type: string | null) => {
    setOperations((prev) =>
      prev.map((operation, i) =>
        i === index ? { ...operation, type } : operation,
      ),
    );
  };

  const updateOperationValue = (index: number, value: number) => {
    setOperations((prev) =>
      prev.map((operation, i) =>
        i === index ? { ...operation, value } : operation,
      ),
    );
  };

  /**
   * Build the ordered list of "type:value" operations for the query param
   */
  const buildOperations = (): string[] => {
    return operations
      .filter((operation) => operation.type)
      .map((operation) => `${operation.type}:${operation.value}`);
  };

  /**
   * Re-fetch plot data (optionally with operations) and update coordinates & plots.
   * Called with operations to apply them, or without to restore raw data.
   */
  const updatePlotsData = async (
    action: 'apply' | 'restore',
    operationsList?: string[],
  ) => {
    try {
      setLoadingAction(action);
      const updatedDataPlot = structuredClone(
        customizedDataGrid,
      ) as DataGridPlot;

      let plotIndex = 0;
      for (const plot of updatedDataPlot.plot) {
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
          undefined,
          operationsList,
        );

        if (plotIndex === 0) {
          // Update coordinates only once because each plots have same coordinates
          let coordinateIndex = 0;
          for (const coordinate of updatedDataPlot.coordinates) {
            // Apply new shape
            coordinate.shape =
              dataPlotOperated.data.coordinates[
                coordinateIndex
              ].downsampled_shape;
            // Apply new data
            coordinate.data =
              dataPlotOperated.data.coordinates[coordinateIndex].value;
            coordinateIndex++;
            // Apply new range
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
        }

        // Update plot with new data
        plot.shape = dataPlotOperated.data.downsampled_shape;
        // Get x axis switch coordinates dependances
        plot.x = getArrayValueFromDependance(updatedDataPlot.coordinates, 0);
        plot.yData = dataPlotOperated.data.value;
        // Get y axis
        const vectorData = getVectorData(
          updatedDataPlot.coordinates,
          plot.yData,
        );
        plot.y = vectorData;

        plotIndex++;
      }

      // Save new configuration with updated data
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
   * Apply the selected operations to the plot data
   */
  const applyOperations = async () => {
    const operationsList = buildOperations();
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
   * Restore the plot data by re-fetching it without operations
   */
  const restoreData = async () => {
    await updatePlotsData('restore');
    setOperations([{ ...EMPTY_OPERATION }]);
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
            data={operationMethods.map((meth) => meth.value)}
            onChange={(value) => updateOperationType(index, value)}
            renderOption={(option) => {
              const selectedOption = operationMethods.find(
                (meth) => option.option.value === meth.value,
              );
              return (
                <RenderSelectOption
                  option={selectedOption}
                  checked={option.checked}
                />
              );
            }}
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
              disabled={operations.length === 1}
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
          disabled={loadingAction === 'restore'}
        >
          Apply
        </Button>
        <Button
          onClick={restoreData}
          loading={loadingAction === 'restore'}
          disabled={loadingAction === 'apply'}
          variant="outline"
          leftSection={<IconRestore size={20} />}
        >
          Restore
        </Button>
      </Group>
    </Stack>
  );
};
