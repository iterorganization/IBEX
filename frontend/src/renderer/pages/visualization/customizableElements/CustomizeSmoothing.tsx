import { useEffect, useState } from 'react';
import { DataGridPlot, SmoothingParams } from '../../../types';
import {
  fetchDataPlot,
  getArrayValueFromDependance,
  getFirstArrayValueFromShape,
  getSmoothingMethods,
  getUrisToInterpolate,
  getVectorData,
  normalizeIndices,
} from '../../../utils';
import { showNotification } from '@mantine/notifications';
import { Button, Group, NumberInput, Select, Stack } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { OptionWithTooltip } from '../../../types/components/select';
import { RenderSelectOption } from '../../../components/select';

const GAUSSIAN_FILTER = 'gaussian_filter';
const SAVGOL_FILTER = 'savitzky-golay_filter';
const SAVGOL_MODES = ['mirror', 'constant', 'nearest', 'wrap', 'interp'];

interface CustomizeSmoothingProps {
  customizedDataGrid: DataGridPlot;
  setCustomizedDataGrid: React.Dispatch<React.SetStateAction<DataGridPlot>>;
}
export const CustomizeSmoothing = ({
  customizedDataGrid,
  setCustomizedDataGrid,
}: CustomizeSmoothingProps) => {
  const [smoothingMethods, setSmoothingMethods] = useState<OptionWithTooltip[]>(
    [],
  );
  const [smoothingMethod, setSmoothingMethod] = useState<string | null>(null);

  // Gaussian filter parameter
  const [gaussianSigma, setGaussianSigma] = useState<number>(1);

  // Savitzky-Golay filter parameters
  const [savgolWindowLength, setSavgolWindowLength] = useState<number>(5);
  const [savgolPolyorder, setSavgolPolyorder] = useState<number>(2);
  const [savgolDeriv, setSavgolDeriv] = useState<number>(0);
  const [savgolDelta, setSavgolDelta] = useState<number>(1.0);
  const [savgolMode, setSavgolMode] = useState<string>('interp');
  const [savgolCval, setSavgolCval] = useState<number>(0.0);

  const [loading, { open, close }] = useDisclosure();

  /**
   * Build the smoothing params for the selected method
   */
  const buildSmoothingParams = (): SmoothingParams | undefined => {
    if (smoothingMethod === GAUSSIAN_FILTER) {
      return {
        smoothing_method: smoothingMethod,
        gaussian_smoothing_sigma: gaussianSigma,
      };
    }
    if (smoothingMethod === SAVGOL_FILTER) {
      return {
        smoothing_method: smoothingMethod,
        savgol_smoothing_window_length: savgolWindowLength,
        savgol_smoothing_polyorder: savgolPolyorder,
        savgol_smoothing_deriv: savgolDeriv,
        savgol_smoothing_delta: savgolDelta,
        savgol_smoothing_mode: savgolMode,
        savgol_smoothing_cval: savgolCval,
      };
    }
    return undefined;
  };

  /**
   * Update configuration with smoothed data (changes coordinates & plots)
   */
  const getSmoothedData = async () => {
    const smoothingParams = buildSmoothingParams();
    if (!smoothingParams) {
      showNotification({
        title: 'No smoothing method',
        message: 'Please select a smoothing method.',
        color: 'red',
      });
      return;
    }
    try {
      open();
      const updatedDataPlot = structuredClone(
        customizedDataGrid,
      ) as DataGridPlot;

      let plotIndex = 0;
      for (const plot of updatedDataPlot.plot) {
        // Smooth data
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
        );

        if (plotIndex === 0) {
          // Update coordinates with smoothed data only once because each plots have same coordinates
          let coordinateIndex = 0;
          for (const coordinate of updatedDataPlot.coordinates) {
            // Apply new shape
            coordinate.shape =
              dataPlotSmoothed.data.coordinates[
                coordinateIndex
              ].downsampled_shape;
            // Apply new data
            coordinate.data =
              dataPlotSmoothed.data.coordinates[coordinateIndex].value;
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

        // Update plot with smoothed data
        plot.shape = dataPlotSmoothed.data.downsampled_shape;
        // Get x axis switch coordinates dependances
        plot.x = getArrayValueFromDependance(updatedDataPlot.coordinates, 0);
        plot.yData = dataPlotSmoothed.data.value;
        // Get y axis
        const vectorData = getVectorData(
          updatedDataPlot.coordinates,
          plot.yData,
        );
        plot.y = vectorData;

        plotIndex++;
      }

      // Save new configuration with smoothed data
      setCustomizedDataGrid({
        ...customizedDataGrid,
        coordinates: updatedDataPlot.coordinates,
        plot: updatedDataPlot.plot,
      });
    } catch (error) {
      console.error('Error getting smoothed data: ', error);
      showNotification({
        title: 'Error',
        message: `Unable to get smoothed data.`,
        color: 'red',
      });
    } finally {
      close();
    }
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
          onChange={setSmoothingMethod}
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
            value={gaussianSigma}
            onChange={(value: number) => setGaussianSigma(value)}
            w="45%"
            maw={200}
            min={0}
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
              value={savgolWindowLength}
              onChange={(value: number) => setSavgolWindowLength(value)}
              w="45%"
              maw={200}
              min={1}
              allowDecimal={false}
            />
            <NumberInput
              label="Polyorder"
              description="Order of the polynomial"
              placeholder="Update the polyorder"
              value={savgolPolyorder}
              onChange={(value: number) => setSavgolPolyorder(value)}
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
              value={savgolDeriv}
              onChange={(value: number) => setSavgolDeriv(value)}
              w="45%"
              maw={200}
              min={0}
              allowDecimal={false}
            />
            <NumberInput
              label="Delta"
              description="Spacing of the samples (used if deriv > 0)"
              placeholder="Update the delta"
              value={savgolDelta}
              onChange={(value: number) => setSavgolDelta(value)}
              w="45%"
              maw={200}
            />
          </Group>
          <Group align="flex-end" justify="space-between">
            <Select
              label="Mode"
              description="Padding mode at the edges"
              placeholder="Select the mode"
              value={savgolMode}
              data={SAVGOL_MODES}
              onChange={(value) => setSavgolMode(value || savgolMode)}
              w="45%"
              maw={200}
            />
            <NumberInput
              label="Cval"
              description="Value to fill past the edges (mode 'constant')"
              placeholder="Update the cval"
              value={savgolCval}
              onChange={(value: number) => setSavgolCval(value)}
              w="45%"
              maw={200}
            />
          </Group>
        </>
      )}

      <Group justify="center">
        <Button
          onClick={getSmoothedData}
          loading={loading}
          disabled={!smoothingMethod}
        >
          Apply
        </Button>
      </Group>
    </Stack>
  );
};
