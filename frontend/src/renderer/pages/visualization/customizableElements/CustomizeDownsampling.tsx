import { useEffect, useState } from 'react';
import { DataGridPlot } from '../../../types';
import {
  fetchDataPlot,
  fetchDownsamplingMethods,
  fetchErrorBands,
  getArrayValueFromDependance,
  getFirstArrayValueFromShape,
  getVectorData,
  normalizeIndices,
} from '../../../utils';
import { showNotification } from '@mantine/notifications';
import { Button, Group, NumberInput, Select, Stack } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { OptionWithTooltip } from '../../../types/components/select';
import { RenderSelectOption } from '../../../components/select';

interface CustomizeDownsamplingProps {
  customizedDataGrid: DataGridPlot;
  setCustomizedDataGrid: React.Dispatch<React.SetStateAction<DataGridPlot>>;
}
export const CustomizeDownsampling = ({
  customizedDataGrid,
  setCustomizedDataGrid,
}: CustomizeDownsamplingProps) => {
  const [downsamplingList, setDownsamplingList] = useState<OptionWithTooltip[]>(
    [],
  );
  const [downsamplingSize, setDownsamplingSize] = useState<number>(1000);
  const [downsamplingMethod, setDownsamplingMethod] = useState<string | null>(
    null,
  );
  const [loading, { open, close }] = useDisclosure();

  /**
   * Update configuration with downsampled data (changes coordinates, plots & error bands)
   */
  const getDownSampledData = async () => {
    try {
      open();
      const updatedDataPlot = JSON.parse(
        JSON.stringify(customizedDataGrid),
      ) as DataGridPlot;

      let plotIndex = 0;
      for (const plot of updatedDataPlot.plot) {
        // Downsample data
        const dataPlotDownsampled = await fetchDataPlot(
          normalizeIndices(plot.nodeUri),
          downsamplingMethod,
          downsamplingSize,
        );

        if (plot.error_y?.type === 'data' && plot.error_y?.array.length > 0) {
          // Downsample error bands with provided parameters if error bands exists for this plot
          await fetchErrorBands(
            updatedDataPlot,
            plot.nodeUri,
            downsamplingMethod,
            downsamplingSize,
          );
        }

        if (plotIndex === 0) {
          // Update coordinates with downsampled data only once because each plots have same coordinates
          let coordinateIndex = 0;
          for (const coordinate of updatedDataPlot.coordinates) {
            // Apply new shape
            coordinate.shape =
              dataPlotDownsampled.data.coordinates[
                coordinateIndex
              ].downsampled_shape;
            // Apply new data
            coordinate.data =
              dataPlotDownsampled.data.coordinates[coordinateIndex].value;
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

          // Update downsampled method
          updatedDataPlot.downsampled_method =
            dataPlotDownsampled.data.downsampled_method;
        }

        // Update plot with downsampled data
        plot.shape = dataPlotDownsampled.data.downsampled_shape;
        // Get x axis switch coordinates dependances
        plot.x = getArrayValueFromDependance(updatedDataPlot.coordinates, 0);
        plot.yData = dataPlotDownsampled.data.value;
        // Get y axis
        const vectorData = getVectorData(
          updatedDataPlot.coordinates,
          plot.yData,
        );
        plot.y = vectorData;

        plotIndex++;
      }

      // Save new configuration with downsampled data
      setCustomizedDataGrid({
        ...customizedDataGrid,
        coordinates: updatedDataPlot.coordinates,
        downsampled_method: updatedDataPlot.downsampled_method,
        downsampled_size: downsamplingSize,
        plot: updatedDataPlot.plot,
      });
    } catch (error) {
      console.error('Error getting downsampled data: ', error);
      showNotification({
        title: 'Error',
        message: `Unable to get downsampled data.`,
        color: 'red',
      });
    } finally {
      close();
    }
  };

  /*
   * Get downsampling methods to show in select
   */
  useEffect(() => {
    const getDownsamplingList = async () => {
      const methodsRes = await fetchDownsamplingMethods();
      const options: OptionWithTooltip[] = methodsRes.downsampling_methods.map(
        (item) => ({
          value: item.name,
          tooltip: item.description,
        }),
      );
      setDownsamplingList(options);
    };
    getDownsamplingList();
  }, []);

  useEffect(() => {
    // Update downsampled method after a timeout
    if (customizedDataGrid.downsampled_method) {
      setDownsamplingMethod(customizedDataGrid.downsampled_method);
    }
  }, [customizedDataGrid.downsampled_method]);

  useEffect(() => {
    // Update downsampled size after a timeout
    if (customizedDataGrid.downsampled_size) {
      setDownsamplingSize(customizedDataGrid.downsampled_size);
    }
  }, [customizedDataGrid.downsampled_size]);

  return (
    <Stack w="fit-content">
      <Group align="flex-end" justify="space-between">
        <Select
          label="Method"
          description="Select the method"
          placeholder="Select the method"
          value={downsamplingMethod || 'None'}
          data={downsamplingList.map((meth) => meth.value)}
          onChange={setDownsamplingMethod}
          renderOption={(option) => {
            const selectedOption = downsamplingList.find(
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
          label="Size"
          description="Update the size"
          placeholder="Update the size"
          value={downsamplingSize}
          onChange={(value: number) => setDownsamplingSize(value)}
          w="45%"
          maw={200}
          min={0}
        />
      </Group>

      <Group justify="center">
        <Button onClick={getDownSampledData} loading={loading}>
          Get downsampled data
        </Button>
      </Group>
    </Stack>
  );
};
