import { useEffect, useState } from 'react';
import { DataGridPlot, DataPlotly, SmoothingParams } from '../../../types';
import {
  buildSmoothingRequest,
  DEFAULT_GAUSSIAN_SMOOTHING_SIGMA,
  DEFAULT_SAVGOL_CVAL,
  DEFAULT_SAVGOL_DELTA,
  DEFAULT_SAVGOL_DERIV,
  DEFAULT_SAVGOL_MODE,
  DEFAULT_SAVGOL_POLYORDER,
  DEFAULT_SAVGOL_WINDOW_LENGTH,
  fetchDataPlot,
  formatOperations,
  formatSignalOperations,
  GAUSSIAN_FILTER,
  getArrayValueFromDependance,
  getFirstArrayValueFromShape,
  getSmoothingMethods,
  getUrisToInterpolate,
  getVectorData,
  MIN_GAUSSIAN_SMOOTHING_SIGMA,
  normalizeIndices,
  reapplyAxisOrder,
  SAVGOL_FILTER,
} from '../../../utils';
import { showNotification } from '@mantine/notifications';
import { Button, Group, NumberInput, Select, Stack } from '@mantine/core';
import { IconRestore } from '@tabler/icons-react';
import { OptionWithTooltip } from '../../../types/components/select';
import { RenderSelectOption } from '../../../components/select';

const SAVGOL_MODES = ['mirror', 'constant', 'nearest', 'wrap', 'interp'];

interface CustomizeSmoothingProps {
  customizedDataGrid: DataGridPlot;
  selectedPlot: DataPlotly | null;
  setCustomizedDataGrid: React.Dispatch<React.SetStateAction<DataGridPlot>>;
}
export const CustomizeSmoothing = ({
  customizedDataGrid,
  selectedPlot,
  setCustomizedDataGrid,
}: CustomizeSmoothingProps) => {
  const [smoothingMethods, setSmoothingMethods] = useState<OptionWithTooltip[]>(
    [],
  );
  const [loadingAction, setLoadingAction] = useState<
    'apply' | 'restore' | null
  >(null);

  // Source of truth is the selected plot's own smoothing config (persisted on the grid)
  const smoothing = selectedPlot?.smoothing;
  const smoothingMethod = smoothing?.smoothing_method ?? null;

  const sigma = Number(
    smoothing?.gaussian_smoothing_sigma ?? DEFAULT_GAUSSIAN_SMOOTHING_SIGMA,
  );
  const isSigmaInvalid =
    smoothingMethod === GAUSSIAN_FILTER &&
    (!Number.isFinite(sigma) || sigma < MIN_GAUSSIAN_SMOOTHING_SIGMA);
  const SIGMA_ERROR = `Sigma must be at least ${MIN_GAUSSIAN_SMOOTHING_SIGMA}`;

  /**
   * Persist the smoothing config onto the selected plot
   */
  const updateSmoothing = (next: SmoothingParams | undefined) => {
    if (!selectedPlot) return;
    const updated = structuredClone(customizedDataGrid) as DataGridPlot;
    const plot = updated.plot.find((p) => p.name === selectedPlot.name);
    if (plot) {
      plot.smoothing = next;
    }
    setCustomizedDataGrid({ ...customizedDataGrid, plot: updated.plot });
  };

  const updateSmoothingMethod = (method: string | null) => {
    updateSmoothing(
      method ? { ...smoothing, smoothing_method: method } : undefined,
    );
  };

  const updateSmoothingParam = (
    param: keyof SmoothingParams,
    value: number | string,
  ) => {
    if (!smoothing) return;
    updateSmoothing({ ...smoothing, [param]: value });
  };

  /**
   * Re-fetch the selected plot's data (optionally with smoothing) and update it.
   * Called with smoothing params to apply smoothing, or without to restore raw data.
   */
  const updatePlotsData = async (
    action: 'apply' | 'restore',
    smoothingParams?: SmoothingParams,
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
      const dataPlotSmoothed = await fetchDataPlot(
        normalizeIndices(plot.nodeUri),
        customizedDataGrid?.downsampled_method,
        customizedDataGrid?.downsampled_size,
        updatedDataPlot?.dataType,
        urisToInterpolate,
        customizedDataGrid?.interpolated_method,
        smoothingParams,
        formatOperations(plot.operations),
        formatSignalOperations(plot.operations),
      );

      // Realign coordinates with the returned data (a no-op when smoothing
      // preserves the shape; needed if the fetch auto-downsampled the data)
      let coordinateIndex = 0;
      for (const coordinate of updatedDataPlot.coordinates) {
        coordinate.shape =
          dataPlotSmoothed.data.coordinates[coordinateIndex].downsampled_shape;
        coordinate.data =
          dataPlotSmoothed.data.coordinates[coordinateIndex].value;
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
      plot.shape = dataPlotSmoothed.data.downsampled_shape;
      plot.x = getArrayValueFromDependance(updatedDataPlot.coordinates, 0);
      plot.yData = dataPlotSmoothed.data.value;
      plot.y = getVectorData(updatedDataPlot.coordinates, plot.yData);
      if (action === 'restore') {
        plot.smoothing = undefined;
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
   * Apply the selected smoothing method to the selected plot
   */
  const getSmoothedData = async () => {
    const smoothingParams = buildSmoothingRequest(smoothing);
    if (!smoothingParams) {
      showNotification({
        title: 'No smoothing method',
        message: 'Please select a smoothing method.',
        color: 'red',
      });
      return;
    }
    if (isSigmaInvalid) {
      showNotification({
        title: 'Invalid sigma',
        message: `${SIGMA_ERROR}.`,
        color: 'red',
      });
      return;
    }
    await updatePlotsData('apply', smoothingParams);
  };

  /**
   * Restore the selected plot by re-fetching it without smoothing
   */
  const restoreData = async () => {
    await updatePlotsData('restore');
  };

  /*
   * Get smoothing methods to show in select
   */
  useEffect(() => {
    const getSmoothingList = async () => {
      const options = await getSmoothingMethods();
      setSmoothingMethods(options);
    };
    getSmoothingList();
  }, []);

  return (
    <Stack w="fit-content">
      <Group align="flex-end" justify="space-between">
        <Select
          label="Method"
          description="Select the method"
          placeholder="Select the method"
          value={smoothingMethod}
          data={smoothingMethods.map((meth) => meth.value)}
          onChange={updateSmoothingMethod}
          data-testid="data-smoothing-method"
          renderOption={(option) => {
            const selectedOption = smoothingMethods.find(
              (meth) => option.option.value === meth.value,
            );
            return (
              <RenderSelectOption
                option={selectedOption}
                checked={option.checked}
              />
            );
          }}
        />
      </Group>

      {smoothingMethod === GAUSSIAN_FILTER && (
        <Group align="flex-end" justify="space-between">
          <NumberInput
            label="Sigma"
            description="Standard deviation for Gaussian kernel"
            placeholder="Update the sigma"
            value={
              smoothing?.gaussian_smoothing_sigma ??
              DEFAULT_GAUSSIAN_SMOOTHING_SIGMA
            }
            onChange={(value) =>
              updateSmoothingParam('gaussian_smoothing_sigma', value)
            }
            onValueChange={(payload, context) => {
              const isSteppedChange = (context.source as string) !== 'event';
              if (
                isSteppedChange &&
                Number.isFinite(payload.floatValue) &&
                payload.floatValue < MIN_GAUSSIAN_SMOOTHING_SIGMA
              ) {
                updateSmoothingParam(
                  'gaussian_smoothing_sigma',
                  MIN_GAUSSIAN_SMOOTHING_SIGMA,
                );
              }
            }}
            error={isSigmaInvalid ? SIGMA_ERROR : undefined}
            data-testid="data-smoothing-sigma"
            w="45%"
            maw={200}
            min={MIN_GAUSSIAN_SMOOTHING_SIGMA}
          />
        </Group>
      )}

      {smoothingMethod === SAVGOL_FILTER && (
        <>
          <Group align="flex-end" justify="space-between">
            <NumberInput
              label="Window length"
              description="Length of the filter window"
              placeholder="Update the window length"
              value={
                smoothing?.savgol_smoothing_window_length ??
                DEFAULT_SAVGOL_WINDOW_LENGTH
              }
              onChange={(value: number) =>
                updateSmoothingParam('savgol_smoothing_window_length', value)
              }
              data-testid="data-smoothing-window-length"
              w="45%"
              maw={200}
              min={1}
              allowDecimal={false}
            />
            <NumberInput
              label="Polyorder"
              description="Order of the polynomial"
              placeholder="Update the polyorder"
              value={
                smoothing?.savgol_smoothing_polyorder ??
                DEFAULT_SAVGOL_POLYORDER
              }
              onChange={(value: number) =>
                updateSmoothingParam('savgol_smoothing_polyorder', value)
              }
              data-testid="data-smoothing-polyorder"
              w="45%"
              maw={200}
              min={0}
              allowDecimal={false}
            />
          </Group>
          <Group align="flex-end" justify="space-between">
            <NumberInput
              label="Deriv"
              description="Order of the derivative to compute"
              placeholder="Update the deriv"
              value={smoothing?.savgol_smoothing_deriv ?? DEFAULT_SAVGOL_DERIV}
              onChange={(value: number) =>
                updateSmoothingParam('savgol_smoothing_deriv', value)
              }
              data-testid="data-smoothing-deriv"
              w="45%"
              maw={200}
              min={0}
              allowDecimal={false}
            />
            <NumberInput
              label="Delta"
              description="Spacing of the samples (used if deriv > 0)"
              placeholder="Update the delta"
              value={smoothing?.savgol_smoothing_delta ?? DEFAULT_SAVGOL_DELTA}
              onChange={(value: number) =>
                updateSmoothingParam('savgol_smoothing_delta', value)
              }
              data-testid="data-smoothing-delta"
              w="45%"
              maw={200}
            />
          </Group>
          <Group align="flex-end" justify="space-between">
            <Select
              label="Mode"
              description="Padding mode at the edges"
              placeholder="Select the mode"
              value={smoothing?.savgol_smoothing_mode ?? DEFAULT_SAVGOL_MODE}
              data={SAVGOL_MODES}
              onChange={(value) =>
                updateSmoothingParam(
                  'savgol_smoothing_mode',
                  value ?? DEFAULT_SAVGOL_MODE,
                )
              }
              data-testid="data-smoothing-mode"
              w="45%"
              maw={200}
            />
            <NumberInput
              label="Cval"
              description="Value to fill past the edges (mode 'constant')"
              placeholder="Update the cval"
              value={smoothing?.savgol_smoothing_cval ?? DEFAULT_SAVGOL_CVAL}
              onChange={(value: number) =>
                updateSmoothingParam('savgol_smoothing_cval', value)
              }
              data-testid="data-smoothing-cval"
              w="45%"
              maw={200}
            />
          </Group>
        </>
      )}

      <Group justify="center">
        <Button
          onClick={getSmoothedData}
          loading={loadingAction === 'apply'}
          disabled={
            !selectedPlot ||
            !smoothingMethod ||
            isSigmaInvalid ||
            loadingAction === 'restore'
          }
          data-testid="data-smoothing-apply-button"
        >
          Apply
        </Button>
        <Button
          onClick={restoreData}
          loading={loadingAction === 'restore'}
          disabled={!selectedPlot || loadingAction === 'apply'}
          variant="outline"
          leftSection={<IconRestore size={20} />}
          data-testid="data-smoothing-restore-button"
        >
          Restore
        </Button>
      </Group>
    </Stack>
  );
};
