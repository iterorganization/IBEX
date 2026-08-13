import { useEffect, useMemo, useState } from 'react';
import {
  DataGridPlot,
  DataOperation,
  DataPlotly,
  OperationKind,
  SignalOperation,
  UnaryOperation,
} from '../../../types';
import {
  buildSmoothingRequest,
  fetchDataPlot,
  formatOperations,
  formatSignalOperations,
  getArrayValueFromDependance,
  getFirstArrayValueFromShape,
  getOperationKind,
  getOperationMethods,
  getSignalOperationMethods,
  getUrisToInterpolate,
  getVectorData,
  isNotifiedError,
  isSignalOperation,
  normalizeIndices,
  reapplyAxisOrder,
  resolveYAxisForUnit,
} from '../../../utils';
import { showNotification } from '@mantine/notifications';
import {
  ActionIcon,
  Button,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import {
  IconCheck,
  IconMinus,
  IconPlus,
  IconRestore,
} from '@tabler/icons-react';

const DEFAULT_UNARY_VALUE = 1;
const EMPTY_UNARY_OPERATION: UnaryOperation = {
  kind: 'unary',
  type: null,
  value: DEFAULT_UNARY_VALUE,
};
const EMPTY_SIGNAL_OPERATION: SignalOperation = {
  kind: 'signal',
  type: null,
  value: null,
};

const SIGNAL_KIND_TOOLTIP =
  'At least two plots are required for a signal operation';

const OPERATION_KINDS: { value: OperationKind; label: string }[] = [
  { value: 'unary', label: 'Constant' },
  { value: 'signal', label: 'Signal' },
];

interface CustomizeDataOperationsProps {
  customizedDataGrid: DataGridPlot;
  selectedPlot: DataPlotly | null;
  setCustomizedDataGrid: React.Dispatch<React.SetStateAction<DataGridPlot>>;
}
export const CustomizeDataOperations = ({
  customizedDataGrid,
  selectedPlot,
  setCustomizedDataGrid,
}: CustomizeDataOperationsProps) => {
  const [unaryMethods, setUnaryMethods] = useState<
    { value: string; label: string }[]
  >([]);
  const [signalMethods, setSignalMethods] = useState<
    { value: string; label: string }[]
  >([]);
  const [loadingAction, setLoadingAction] = useState<
    'apply' | 'restore' | null
  >(null);

  // Source of truth is the selected plot's own operations (persisted on the grid)
  const operations = selectedPlot?.operations ?? [{ ...EMPTY_UNARY_OPERATION }];

  // A signal operation can only target another plot of the same grid
  const operandOptions = useMemo(
    () =>
      (customizedDataGrid?.plot ?? [])
        .filter(
          (plot) => plot.nodeUri && plot.nodeUri !== selectedPlot?.nodeUri,
        )
        .map((plot) => ({
          value: plot.nodeUri,
          label: plot.name || plot.nodeUri,
        })),
    [customizedDataGrid?.plot, selectedPlot?.nodeUri],
  );
  const isSignalKindDisabled = operandOptions.length === 0;

  /**
   * Persist the operations rows onto the selected plot
   */
  const updateOperations = (next: DataOperation[]) => {
    if (!selectedPlot) return;
    const updated = structuredClone(customizedDataGrid) as DataGridPlot;
    const plot = updated.plot.find((p) => p.nodeUri === selectedPlot.nodeUri);
    if (plot) {
      plot.operations = next;
    }
    setCustomizedDataGrid({ ...customizedDataGrid, plot: updated.plot });
  };

  const addOperation = () => {
    // Keep the kind of the last row so that building several signal operations
    // in a row does not require switching the kind every time
    const lastOperation = operations[operations.length - 1];
    const addSignalOperation =
      !isSignalKindDisabled &&
      lastOperation &&
      getOperationKind(lastOperation) === 'signal';
    updateOperations([
      ...operations,
      addSignalOperation
        ? { ...EMPTY_SIGNAL_OPERATION }
        : { ...EMPTY_UNARY_OPERATION },
    ]);
  };

  const removeOperation = (index: number) => {
    updateOperations(operations.filter((_, i) => i !== index));
  };

  /**
   * Switch a row between a constant and a signal operand. The row is replaced
   * rather than merged because the value changes type along with the kind.
   */
  const updateOperationKind = (index: number, kind: OperationKind) => {
    updateOperations(
      operations.map((operation, i) => {
        if (i !== index || getOperationKind(operation) === kind) {
          return operation;
        }
        // Keep the operation type only when the target kind supports it:
        // add / sub / mul / div are shared, pow and root are constant only
        const methods = kind === 'signal' ? signalMethods : unaryMethods;
        const keptType = methods.some(
          (method) => method.value === operation.type,
        )
          ? operation.type
          : null;
        return kind === 'signal'
          ? { ...EMPTY_SIGNAL_OPERATION, type: keptType }
          : { ...EMPTY_UNARY_OPERATION, type: keptType };
      }),
    );
  };

  const updateOperationType = (index: number, type: string | null) => {
    updateOperations(
      operations.map((operation, i) =>
        i === index ? { ...operation, type } : operation,
      ),
    );
  };

  const updateOperationValue = (index: number, value: string | number) => {
    // NumberInput emits an empty string when the field is cleared
    const numericValue = typeof value === 'number' ? value : Number(value);
    updateOperations(
      operations.map((operation, i) =>
        i === index && !isSignalOperation(operation)
          ? {
              ...operation,
              value: Number.isFinite(numericValue)
                ? numericValue
                : DEFAULT_UNARY_VALUE,
            }
          : operation,
      ),
    );
  };

  const updateOperationSignal = (index: number, value: string | null) => {
    updateOperations(
      operations.map((operation, i) =>
        i === index && isSignalOperation(operation)
          ? { ...operation, value }
          : operation,
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
    signalOperationsList?: string[],
  ) => {
    if (!selectedPlot) return;
    try {
      setLoadingAction(action);
      const updatedDataPlot = structuredClone(
        customizedDataGrid,
      ) as DataGridPlot;

      const plot = updatedDataPlot.plot.find(
        (p) => p.nodeUri === selectedPlot.nodeUri,
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
        signalOperationsList,
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
      // A multiplication or a division between signals changes the unit, which
      // may require moving the plot to the secondary y axis
      const newUnit = dataPlotOperated.data.unit;
      if (!resolveYAxisForUnit(updatedDataPlot, plot, newUnit)) {
        showNotification({
          title: 'Too many units',
          message: `This operation produces data in "${newUnit}", but the graph already uses two y axes. Remove a signal from the graph or change the operation.`,
          color: 'red',
        });
        return;
      }

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
        yAxisData: updatedDataPlot.yAxisData,
        y2AxisData: updatedDataPlot.y2AxisData,
      });
    } catch (error) {
      console.error('Error getting plot data: ', error);
      if (!isNotifiedError(error)) {
        // The server already details why an operation could not be applied
        showNotification({
          title: 'Error',
          message: `Unable to get plot data.`,
          color: 'red',
        });
      }
    } finally {
      setLoadingAction(null);
    }
  };

  /**
   * Apply the operations to the selected plot
   */
  const applyOperations = async () => {
    const operationsList = formatOperations(operations);
    const signalOperationsList = formatSignalOperations(operations);

    const hasIncompleteSignalOperation = operations.some(
      (operation) =>
        isSignalOperation(operation) && operation.type && !operation.value,
    );
    if (hasIncompleteSignalOperation) {
      showNotification({
        title: 'Incomplete operation',
        message: 'Please select a signal for every signal operation.',
        color: 'red',
      });
      return;
    }

    if (!operationsList.length && !signalOperationsList.length) {
      showNotification({
        title: 'No operation',
        message: 'Please add at least one operation.',
        color: 'red',
      });
      return;
    }
    await updatePlotsData('apply', operationsList, signalOperationsList);
  };

  /**
   * Restore the selected plot by re-fetching it without operations
   */
  const restoreData = async () => {
    await updatePlotsData('restore');
  };

  /*
   * Get operation methods to show in selects
   */
  useEffect(() => {
    const getOperationList = async () => {
      const [unaryOptions, signalOptions] = await Promise.all([
        getOperationMethods(),
        getSignalOperationMethods(),
      ]);
      setUnaryMethods(unaryOptions);
      setSignalMethods(signalOptions);
    };
    getOperationList();
  }, []);

  const hasMixedKinds =
    operations.some(isSignalOperation) &&
    operations.some((operation) => !isSignalOperation(operation));

  return (
    <Stack w="fit-content">
      {operations.map((operation, index) => (
        <Group
          key={index}
          align="flex-end"
          justify="space-between"
          wrap="nowrap"
        >
          <Select
            label="Kind"
            description="Operand type"
            value={getOperationKind(operation)}
            data={OPERATION_KINDS.map((kind) => ({
              ...kind,
              disabled: kind.value === 'signal' && isSignalKindDisabled,
            }))}
            onChange={(value) =>
              updateOperationKind(index, value as OperationKind)
            }
            allowDeselect={false}
            disabled={loadingAction !== null}
            renderOption={({ option, checked }) => (
              <Tooltip
                label={SIGNAL_KIND_TOOLTIP}
                disabled={!(option.value === 'signal' && isSignalKindDisabled)}
                position="right"
                openDelay={200}
              >
                <Group gap="xs" w="100%" wrap="nowrap">
                  {checked && <IconCheck size={16} />}
                  {option.label}
                </Group>
              </Tooltip>
            )}
            data-testid={`data-operation-kind-${index}`}
            w="25%"
            maw={130}
          />
          <Select
            label="Operation"
            description="Select the operation"
            placeholder="Select the operation"
            value={operation.type}
            data={isSignalOperation(operation) ? signalMethods : unaryMethods}
            onChange={(value) => updateOperationType(index, value)}
            disabled={loadingAction !== null}
            data-testid={`data-operation-type-${index}`}
            w="30%"
            maw={200}
          />
          {isSignalOperation(operation) ? (
            <Select
              label="Signal"
              description="Plot to combine with"
              placeholder="Select the plot"
              value={operation.value}
              data={operandOptions}
              onChange={(value) => updateOperationSignal(index, value)}
              error={
                operation.value &&
                !operandOptions.some(
                  (option) => option.value === operation.value,
                )
                  ? 'This plot is no longer in the grid'
                  : undefined
              }
              disabled={loadingAction !== null}
              searchable
              data-testid={`data-operation-signal-${index}`}
              w="30%"
              maw={200}
            />
          ) : (
            <NumberInput
              label="Value"
              description="Scalar value for the operation"
              placeholder="Update the value"
              value={operation.value}
              onChange={(value) => updateOperationValue(index, value)}
              disabled={loadingAction !== null}
              data-testid={`data-operation-value-${index}`}
              w="30%"
              maw={200}
            />
          )}
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

      {hasMixedKinds && (
        <Text size="xs" c="dimmed">
          Constant operations are always applied before signal operations,
          whatever the order of the rows.
        </Text>
      )}

      <Group justify="flex-start">
        <Button
          variant="subtle"
          leftSection={<IconPlus size={16} />}
          onClick={addOperation}
          data-testid="data-operations-add-button"
        >
          Add operation
        </Button>
      </Group>

      <Group justify="center">
        <Button
          onClick={applyOperations}
          loading={loadingAction === 'apply'}
          disabled={!selectedPlot || loadingAction === 'restore'}
          data-testid="data-operations-apply-button"
        >
          Apply
        </Button>
        <Button
          onClick={restoreData}
          loading={loadingAction === 'restore'}
          disabled={!selectedPlot || loadingAction === 'apply'}
          variant="outline"
          leftSection={<IconRestore size={20} />}
          data-testid="data-operations-restore-button"
        >
          Restore
        </Button>
      </Group>
    </Stack>
  );
};
