import { useEffect, useState } from 'react';
import { DataGridPlot } from '../../../types';
import {
  fetchDataPlot,
  fetchDataManipulationMethods,
  fetchErrorBands,
  getArrayValueFromDependance,
  getFirstArrayValueFromShape,
  getVectorData,
  normalizeIndices,
} from '../../../utils';
import { showNotification } from '@mantine/notifications';
import { Group, Loader, Select, Stack } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { OptionWithTooltip } from '../../../types/components/select';
import { RenderSelectOption } from '../../../components/select';

interface CustomizeInterpolationProps {
  customizedDataGrid: DataGridPlot;
  setCustomizedDataGrid: React.Dispatch<React.SetStateAction<DataGridPlot>>;
}
export const CustomizeInterpolation = ({
  customizedDataGrid,
  setCustomizedDataGrid,
}: CustomizeInterpolationProps) => {
  const [interpolationMethods, setInterpolationMethods] = useState<
    OptionWithTooltip[]
  >([]);
  const [selectedInterpolation, setSelectedInterpolation] = useState<
    string | null
  >(null);
  const [loading, { open, close }] = useDisclosure();

  /**
   * Update configuration with interpolated data (changes coordinates, plots & error bands)
   */
  const getInterpolatedData = async () => {
    try {
      open();
      const updatedDataPlot = structuredClone(
        customizedDataGrid,
      ) as DataGridPlot;

      let plotIndex = 0;
      for (const plot of updatedDataPlot.plot) {
        // Interpolated data
        const dataPlotInterpolated = await fetchDataPlot(
          normalizeIndices(plot.nodeUri),
          customizedDataGrid?.downsampled_method,
          customizedDataGrid?.downsampled_size,
          updatedDataPlot?.dataType,
          undefined,
          selectedInterpolation,
        );

        if (plot?.error_bands?.length) {
          // Interpolate error bands with provided parameters if error bands exists for this plot
          await fetchErrorBands(
            updatedDataPlot,
            plot.nodeUri,
            undefined,
            undefined,
            // selectedInterpolation, // TODO : force the interpolation with the selected one
          );
        }

        if (plotIndex === 0) {
          // Update coordinates with interpolated data only once because each plots have same coordinates
          let coordinateIndex = 0;
          for (const coordinate of updatedDataPlot.coordinates) {
            // Apply new shape
            coordinate.shape =
              dataPlotInterpolated.data.coordinates[
                coordinateIndex
              ].downsampled_shape;
            // Apply new data
            coordinate.data =
              dataPlotInterpolated.data.coordinates[coordinateIndex].value;
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

          // Update interpolated method
          updatedDataPlot.interpolated_method =
            dataPlotInterpolated.data.interpolated_method;
        }

        // Update plot with interpolated data
        plot.shape = dataPlotInterpolated.data.downsampled_shape;
        // Get x axis switch coordinates dependances
        plot.x = getArrayValueFromDependance(updatedDataPlot.coordinates, 0);
        plot.yData = dataPlotInterpolated.data.value;
        // Get y axis
        const vectorData = getVectorData(
          updatedDataPlot.coordinates,
          plot.yData,
        );
        plot.y = vectorData;

        plotIndex++;
      }

      // Save new configuration with interpolated data
      setCustomizedDataGrid({
        ...customizedDataGrid,
        coordinates: updatedDataPlot.coordinates,
        interpolated_method: updatedDataPlot.interpolated_method,
        plot: updatedDataPlot.plot,
      });
    } catch (error) {
      console.error('Error getting interpolated data: ', error);
      showNotification({
        title: 'Error',
        message: `Unable to get interpolated data.`,
        color: 'red',
      });
    } finally {
      close();
    }
  };

  /*
   * Get interpolated methods to show in select
   */
  useEffect(() => {
    const getInterpolationMethods = async () => {
      const methodsRes = await fetchDataManipulationMethods();
      const options: OptionWithTooltip[] = methodsRes.data_manipulation_methods
        .find((data_manip) => data_manip.name === 'Data interpolation')
        .method_parameters.find(
          (param) => param.name === 'interpolation_method',
        )
        .possible_values.map((item) => ({
          value: item.value,
          tooltip: item.description,
        }));
      setInterpolationMethods(options);
    };
    getInterpolationMethods();
  }, []);

  useEffect(() => {
    // Update interpolated method after a timeout
    if (customizedDataGrid.interpolated_method) {
      setSelectedInterpolation(customizedDataGrid.interpolated_method);
    }
  }, [customizedDataGrid.interpolated_method]);

  useEffect(() => {
    if (selectedInterpolation) {
      getInterpolatedData();
    }
  }, [selectedInterpolation]);

  return (
    <Stack w="fit-content">
      <Group align="flex-end" justify="space-between">
        <Select
          label="Method"
          description="Select the method"
          placeholder="Select the method"
          value={selectedInterpolation || 'exact_value'}
          data={interpolationMethods.map((meth) => meth.value)}
          rightSection={loading ? <Loader size={16} /> : null}
          onChange={(selectedMethod) =>
            setSelectedInterpolation(selectedMethod || 'exact_value')
          }
          renderOption={(option) => {
            const selectedOption = interpolationMethods.find(
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
    </Stack>
  );
};
