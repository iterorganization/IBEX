import { showNotification } from '@mantine/notifications';
import {
  Axis,
  AxisData,
  BaseCoordinates,
  Configuration,
  ConfigurationToSave,
  Coordinates,
  DataGridPlot,
  DataPlotly,
  ErrorBandData,
  PlotCoordinatesResponse,
  PlotDataResponse,
  URIData,
  URITreeNodeData,
} from '../types';
import { fetchDataPlot, fetchFieldValue } from './fetchData';
import { generateNewGridPlot } from './grid';
import {
  getDefaultUri,
  getLastIndexedField,
  normalizeIndices,
  updateIndexFieldName,
} from './uri';
import {
  getArrayValueFromDependance,
  getFirstArrayValueFromShape,
} from './matrix';
import * as tf from '@tensorflow/tfjs';
import { ErrorBar } from 'plotly.js';
import { removeSuffix } from './functions';

/**
 * @description Generates a new DataGridPlot with the provided coordinates, xAxis, and yAxis.
 * @param coordinates The coordinates to include in the plot.
 * @param xAxis The x-axis data for the plot.
 * @param yAxis The y-axis data for the plot.
 * @param dataPlot The existing DataGridPlot to update or create a new one.
 * @returns A new DataGridPlot object with the provided data.
 */
export const plotData = (
  dataPlot: DataGridPlot,
  name: string,
  xValue: number[],
  yValue: number[],
  yData: AxisData,
  nodeUri: string,
  dimensions: number,
  path: string,
  shape: number[],
  labelUri: string,
  unit: string,
  downsampled_method: string,
  description?: string,
  y2Axis?: boolean,
): DataGridPlot => {
  const trace: DataPlotly = {
    x: xValue,
    y: yValue,
    yData: yData,
    name: name ? `${name}_${labelUri}` : '',
    mode: 'lines',
    nodeUri: nodeUri,
    description: description,
    path: path,
    dimensions: dimensions,
    shape: shape,
    labelUri: labelUri,
    unit: unit,
    yaxis: y2Axis || dataPlot?.y2AxisData?.unit === unit ? 'y2' : '',
  };
  if (yValue.length === 0) {
    showNotification({
      title: 'Plot',
      message: `No data to plot for ${trace.name}`,
      color: 'yellow',
    });
  }

  const currentPlot = Array.isArray(dataPlot.plot) ? dataPlot.plot : [];

  return {
    ...dataPlot,
    title:
      // If the title is overwritten we keep it like that
      dataPlot.isTitleOverwritten
        ? dataPlot.title
        : // Else if the dataPlot already has a title, append the trace name to it
          dataPlot.title === ''
          ? `${trace.name}`
          : `${dataPlot.title} / ${trace.name}`,
    downsampled_method: downsampled_method,
    plot: [...currentPlot, trace],
  };
};

/**
 * @description Handles new plots by fetching data for the provided nodes.
 * @param nodes The nodes to create new plots for.
 * @param updatedActive The updated active configuration.
 * @returns The updated active configuration.
 */
export const handleNewPlot = async (
  nodes: URITreeNodeData[],
  updatedActive: Configuration,
): Promise<Configuration> => {
  //* By default we take index [:]
  //* : corresponds to all indices (matrix)
  let defaultUri = nodes[0].uri; //Use normalized URI to get all matrix

  const response: PlotDataResponse = await fetchDataPlot(defaultUri);
  defaultUri = getDefaultUri(defaultUri); //Set defaultUri [0] by default

  let coordinatesOfFirstPlot: Coordinates[] = [];
  let xAxis: Axis = null;

  if (response.data.coordinates.length > 0) {
    //Get index [0] by default xAxis
    //Set the xAxis properties
    xAxis = {
      name: response.data.coordinates[0].name,
      unit: response.data.coordinates[0].unit,
      path: getDefaultUri(response.data.coordinates[0].path),
    };

    //Get coordinates data
    coordinatesOfFirstPlot = response.data.coordinates.map(
      (coordinate: PlotCoordinatesResponse, index) => {
        const dataValueMatrix: AxisData = coordinate.value;

        return {
          name: coordinate.name,
          shape: coordinate.shape,
          downsampled_shape: coordinate.downsampled_shape,
          coordinates: coordinate.coordinates,
          data: dataValueMatrix,
          valueIndex: 0,
          path: getDefaultUri(coordinate.path),
          target: getDefaultUri(coordinate.target),
          nodeUri: defaultUri,
          axeIndex: index,
          unit: coordinate.unit || '',
        };
      },
    );
  }

  // Set the yAxis properties
  const yAxis: Axis = {
    name: response.data.name,
    unit: response.data.unit,
  };

  const newGrid = generateNewGridPlot(
    coordinatesOfFirstPlot,
    xAxis,
    yAxis,
    updatedActive.dataPlot || [],
  );

  let defaultXValue: number[] = [];
  if (response.data.coordinates.length > 0) {
    defaultXValue = getFirstArrayValueFromShape(
      response.data.coordinates[0].value,
      response.data.coordinates[0].shape as number[],
    );
  }

  const defaultYValue = getFirstArrayValueFromShape(
    response.data.value,
    response.data.shape as number[],
  );

  const updatedPlot: DataGridPlot = plotData(
    newGrid,
    yAxis.name,
    defaultXValue,
    defaultYValue,
    response.data.value,
    defaultUri,
    response.data.ndim,
    getDefaultUri(response.data.path),
    response.data.shape as number[],
    nodes[0].name,
    response.data.unit,
    response.data.downsampled_method,
    response.data.description,
  );
  updatedActive.dataPlot.push(updatedPlot);
  return updatedActive;
};

/**
 * @description Handles existing plots by checking if the nodes match the plot's nodes.
 * If they do, it updates the plot; otherwise, it fetches new data for the nodes.
 * @param nodes The nodes to update plots for.
 * @param findDataPlot The data plot to find and update.
 * @param updatedActive The updated active configuration.
 * @returns The updated active configuration.
 */
export const handleExistingPlot = async (
  nodes: URITreeNodeData[],
  findDataPlot: DataGridPlot,
  updatedActive: Configuration,
): Promise<Configuration> => {
  const dataToPlot = nodes.filter(
    (node) =>
      !findDataPlot.plot.some(
        (plot) =>
          normalizeIndices(plot.nodeUri) === node.uri &&
          plot.labelUri === node.name,
      ) &&
      // Remove error bands to fetch only main data for each plots
      !node.uri.endsWith('_error_upper') &&
      !node.uri.endsWith('_error_lower'),
  );

  if (dataToPlot.length === 0) {
    return updateExistingPlot(nodes, findDataPlot, updatedActive);
  }

  for (const node of dataToPlot) {
    let defaultUri = node.uri;
    if (defaultUri.split('#')[0] !== nodes[0].uri.split('#')[0]) {
      showNotification({
        title: 'Plot',
        message: 'Unable to plot data from different URIs',
        color: 'yellow',
      });
      updatedActive.checkedNodeURI = nodes.filter((n) => n !== node);
      continue;
    }

    // For each dataPlot call fetchDataPlot to get data from BE
    const response = await fetchDataPlot(
      defaultUri,
      findDataPlot?.downsampled_method,
      findDataPlot?.downsampled_size,
    );

    defaultUri = getDefaultUri(defaultUri); //Set defaultUri [0] by default

    const unit = response.data.unit;
    const unitExists =
      findDataPlot.yAxisData.unit === unit ||
      (findDataPlot.y2AxisData && findDataPlot.y2AxisData.unit === unit);

    const xAxis = findDataPlot.xAxisData;
    const coordsResponse = response.data.coordinates;

    const sliderExist =
      findDataPlot.coordinates &&
      findDataPlot.coordinates.length > 0 &&
      coordsResponse.length > 1;

    let xAxisResponsePath = '';
    if (response.data.coordinates.length > 0) {
      xAxisResponsePath = getDefaultUri(coordsResponse[0].path);
    }
    let yDataResponsePath = getDefaultUri(response.data.path);

    if (sliderExist) {
      /**
       * If slider exists, we need to update the index of the response coordinates
       * to match the coordinates in the findDataPlot.
       */
      const coordResponses = coordsResponse.slice(1);

      coordResponses.forEach((coordRes) => {
        const matchingCoord = findDataPlot.coordinates.find(
          (c) => c.name === coordRes.name,
        );

        if (!matchingCoord) return;

        const lastField = getLastIndexedField(coordRes.target);

        if (!lastField) return;

        coordsResponse.forEach((res) => {
          res.target = updateIndexFieldName(
            res.target,
            lastField,
            matchingCoord.valueIndex,
          );
        });

        //* Update the defaultUri, xAxisResponsePath, and yDataResponsePath to match the index
        defaultUri = updateIndexFieldName(
          defaultUri,
          lastField,
          matchingCoord.valueIndex,
        );
        xAxisResponsePath = updateIndexFieldName(
          xAxisResponsePath,
          lastField,
          matchingCoord.valueIndex,
        );
        yDataResponsePath = updateIndexFieldName(
          yDataResponsePath,
          lastField,
          matchingCoord.valueIndex,
        );
      });
    }

    const coordinatesExistAndMatch =
      findDataPlot.coordinates.length === coordsResponse.length &&
      JSON.parse(JSON.stringify(findDataPlot.coordinates))
        .sort(compareByAxeIndex)
        .every((coord: Coordinates, index: number) => {
          const responseCoord = coordsResponse[index];
          return coord.name === responseCoord.name;
        });

    if (sliderExist && !coordinatesExistAndMatch) {
      showNotification({
        title: 'Plot',
        message: 'Coordinates do not match or are missing',
        color: 'yellow',
      });
      updatedActive.checkedNodeURI = nodes.filter((n) => n !== node);
      continue;
    }

    // Check if the xAxisData matches the first coordinate
    if (xAxis && coordsResponse.length > 0) {
      if (
        xAxis.name !== coordsResponse[0].name ||
        xAxis.unit !== coordsResponse[0].unit ||
        xAxis.path !== xAxisResponsePath
      ) {
        showNotification({
          title: 'Plot',
          message: 'X axis data does not match the first coordinate',
          color: 'yellow',
        });
        updatedActive.checkedNodeURI = nodes.filter((n) => n !== node);
        continue;
      }
    }

    const xAxisMissingOrMismatch =
      (!xAxis && coordsResponse.length > 0) ||
      (xAxis && coordsResponse.length === 0) ||
      (xAxis &&
        coordsResponse.slice(1).length == findDataPlot.coordinates.length &&
        // Check if the xAxisData matches the first coordinate
        (xAxis.name !== coordsResponse[0].name ||
          xAxis.unit !== coordsResponse[0].unit ||
          xAxis.path !== xAxisResponsePath));

    if (xAxisMissingOrMismatch) {
      showNotification({
        title: 'Plot',
        message: 'X axis data is missing or does not match',
        color: 'yellow',
      });
      updatedActive.checkedNodeURI = nodes.filter((n) => n !== node);
      continue;
    }

    const yAxis: Axis = {
      name: response.data.name,
      unit: unit,
    };

    let defaultXValue: number[] = [];
    if (response.data.coordinates.length > 0) {
      defaultXValue = getFirstArrayValueFromShape(
        response.data.coordinates[0].value,
        response.data.coordinates[0].downsampled_shape as number[],
      );
    }

    const defaultYValue = getVectorData(
      findDataPlot.coordinates,
      response.data.value,
    );

    let updatedPlot: DataGridPlot;
    if (unitExists) {
      updatedPlot = await plotData(
        findDataPlot,
        yAxis.name,
        defaultXValue,
        defaultYValue,
        response.data.value,
        defaultUri,
        response.data.ndim,
        yDataResponsePath,
        response.data.downsampled_shape as number[],
        node.name,
        response.data.unit,
        response.data.downsampled_method,
        response.data.description,
      );
    } else if (!findDataPlot.y2AxisData) {
      findDataPlot.y2AxisData = {
        name: yAxis.name,
        unit: unit,
      };

      updatedPlot = await plotData(
        findDataPlot,
        yAxis.name,
        defaultXValue,
        defaultYValue,
        response.data.value,
        defaultUri,
        response.data.ndim,
        yDataResponsePath,
        response.data.downsampled_shape as number[],
        node.name,
        response.data.unit,
        response.data.downsampled_method,
        response.data.description,
        true,
      );
    } else {
      showNotification({
        title: 'Plot',
        message: 'Plot already contains 2 y axes',
        color: 'yellow',
      });
      updatedActive.checkedNodeURI = nodes.filter((n) => n !== node);
    }

    // For each dataPlot get error bands
    if (updatedPlot) {
      updatedActive.dataPlot = [
        ...(updatedActive.dataPlot || []).filter(
          (plot) => plot.i !== findDataPlot.i,
        ),
        updatedPlot,
      ];
    }

    await fetchErrorBandsInConfig(updatedActive, defaultUri);

    // Apply range to new error bands when adding another plot
    for (const coordinate of updatedPlot.coordinates) {
      if (coordinate?.range) {
        updatedPlot = await applyRange(
          coordinate,
          coordinate.range,
          updatedPlot,
          [defaultUri],
        );
      }
    }
  }

  return updatedActive;
};

/**
 * @description Updates existing plot if deselected nodes match the plot's nodes.
 * @param nodes The nodes to update plots for.
 * @param findDataPlot The data plot to find and update.
 * @param updatedActive The updated active configuration.
 * @returns The updated active configuration.
 */
const updateExistingPlot = (
  nodes: URITreeNodeData[],
  findDataPlot: DataGridPlot,
  updatedActive: Configuration,
): Configuration => {
  const plots = findDataPlot?.plot.filter((plot: DataPlotly) =>
    nodes.some(
      (node: URITreeNodeData) =>
        node.uri === normalizeIndices(plot.nodeUri) &&
        node.name === plot.labelUri,
    ),
  );

  /**
   * If all plots have the same y axis with reference(plots[0]), we can set the reference y axis for all plots and remove y2AxisData
   */
  if (plots.every((plot) => plot.yaxis === plots[0].yaxis)) {
    findDataPlot.yAxisData =
      plots[0].yaxis == 'y2' ? findDataPlot.y2AxisData : findDataPlot.yAxisData;
    findDataPlot.y2AxisData = undefined;

    for (const plot of plots) {
      plot.yaxis = '';
    }
  }

  findDataPlot.plot = plots;
  findDataPlot.title = findDataPlot.isTitleOverwritten
    ? findDataPlot.title
    : plots.map((plot) => plot.name).join('/');
  updatedActive.dataPlot = [
    ...updatedActive.dataPlot.filter((plot) => plot.i !== findDataPlot.i),
    findDataPlot,
  ];
  return updatedActive;
};

/**
 * Get error bands of the provided uri and update configuration
 * @param active
 * @param uri
 */
export const fetchErrorBandsInConfig = async (
  active: Configuration,
  uri: string,
) => {
  let dataPlotWithErrBands: DataGridPlot[];
  const data = active.dataPlot.find((d) => d.isEditing);
  if (!data) {
    // Don't get error bands when no editing dataPlot
    return;
  }

  const selectedDataPlot = active.dataPlot.find(
    (dataPlot) => dataPlot.i === data.i,
  );
  if (!selectedDataPlot.displayErrorBand) {
    // Stop error bands when the dataPlot switch is off
    return;
  }

  try {
    dataPlotWithErrBands = active.dataPlot;
    const updatedDataPlot = dataPlotWithErrBands.find((d) => d.i === data.i);
    const errBandsResponse = await fetchErrorBands(updatedDataPlot, uri);

    if (errBandsResponse) {
      const plot = selectedDataPlot.plot.find(
        (p) => normalizeIndices(p.nodeUri) === normalizeIndices(uri),
      );
      const updatedPlot = dataPlotWithErrBands
        .find((dataPlot) => dataPlot.i === data.i)
        .plot.find((plotToUpdate) => plotToUpdate.nodeUri === plot.nodeUri);
      const updatedCheckedNodeURI = active.checkedNodeURI;
      if (data.isEditing && updatedPlot?.error_bands) {
        // Check error bands in tree
        for (const error_band of updatedPlot.error_bands) {
          const newCheckedNode = {
            name: updatedPlot.labelUri,
            uri: normalizeIndices(error_band.path),
          };
          const exists = updatedCheckedNodeURI.some(
            (node) =>
              node.name === newCheckedNode.name &&
              node.uri === newCheckedNode.uri,
          );
          if (!exists) {
            updatedCheckedNodeURI.push(newCheckedNode);
          }
        }
      }

      // Return updated config
      return {
        ...active,
        checkedNodeURI: updatedCheckedNodeURI,
      };
    }
  } catch (error) {
    console.error('Error in fetchErrorBandsInConfig: ', error);
  }
};

/**
 * Get & return error bands of provided uri & dataPlot id
 * @param dataPlot Datagrid containing the targeted uri
 * @param uri Uri to get the data
 * @param forcedDownsamplingMethod Forced downsample method (optional)
 * @param forcedDownsamplingSize Forced downsample size (optional)
 * @returns
 */
export const fetchErrorBands = async (
  dataPlot: DataGridPlot,
  uri: string,
  forcedDownsamplingMethod?: string,
  forcedDownsamplingSize?: number,
) => {
  if (!dataPlot.displayErrorBand) {
    // Stop error bands when the dataPlot switch is off
    return;
  }

  const plot = dataPlot.plot.find(
    (p) => normalizeIndices(p.nodeUri) === normalizeIndices(uri),
  );
  if (!plot) {
    // No matching data: return dataPlot with no updates
    return dataPlot;
  }

  try {
    const downsamplingMethod: string =
      forcedDownsamplingMethod || dataPlot?.downsampled_method;
    const downsamplingSize: number =
      forcedDownsamplingSize || dataPlot?.downsampled_size;

    // Get error bands
    const upperResponse = await fetchFieldValue(
      normalizeIndices(plot.nodeUri) + '_error_upper',
      downsamplingMethod,
      downsamplingSize,
    );
    const defaultUpperYValue = getVectorData(
      dataPlot.coordinates,
      upperResponse.value,
    );
    await formatErrorBands(
      plot,
      defaultUpperYValue,
      upperResponse.value,
      plot.nodeUri + '_error_upper',
    );

    const lowerResponse = await fetchFieldValue(
      normalizeIndices(plot.nodeUri) + '_error_lower',
    );
    const defaultLowerYValue = getVectorData(
      dataPlot.coordinates,
      lowerResponse.value,
    );
    await formatErrorBands(
      plot,
      defaultLowerYValue,
      lowerResponse.value,
      plot.nodeUri + '_error_lower',
    );

    // Return dataPlot list with the plot which includes error bands
    return dataPlot;
  } catch (error) {
    console.error('Error handling error bands: ', error);
  }
};

/**
 * Format plot to includes error bands values
 * @param foundedPlot The plot to format
 * @param yValue
 * @param yData
 * @param nodeUri
 */
const formatErrorBands = (
  foundedPlot: DataPlotly,
  yValue: number[],
  yData: AxisData,
  nodeUri: string,
) => {
  if (!(nodeUri.endsWith('_error_lower') || nodeUri.endsWith('_error_upper'))) {
    return;
  }

  // Change the plot format to show error bands
  let error_suffix = '';
  if (nodeUri.endsWith('_error_lower')) {
    error_suffix = '_error_lower';
  } else if (nodeUri.endsWith('_error_upper')) {
    error_suffix = '_error_upper';
  }
  const mainNodeUri = removeSuffix(nodeUri, error_suffix);

  if (foundedPlot && !foundedPlot?.error_bands) {
    // Init error_bands
    foundedPlot.error_bands = [];
  }

  if (!foundedPlot?.error_y) {
    // Init error_y
    foundedPlot.error_y = {
      type: 'data',
      symmetric: true,
      array: yValue,
    };
  }

  if (foundedPlot?.error_bands?.length) {
    // We are not in symectric case when there is more than one selected error band
    foundedPlot.error_y.symmetric = false;
  }

  if (
    error_suffix === '_error_lower' &&
    foundedPlot?.error_bands.find(
      (error_band) =>
        error_band.path === normalizeIndices(mainNodeUri) + '_error_upper',
    ) &&
    foundedPlot?.error_y?.type === 'data'
  ) {
    // Set to arrayminus when lower & other error_band
    foundedPlot.error_y.arrayminus = yValue;
  } else if (
    error_suffix === '_error_upper' &&
    foundedPlot?.error_bands.find(
      (error_band) =>
        error_band.path === normalizeIndices(mainNodeUri) + '_error_lower',
    ) &&
    foundedPlot?.error_y?.type === 'data'
  ) {
    // Set lower as arrayminus when select upper & having lower
    foundedPlot.error_y.arrayminus = foundedPlot.error_y.array;
    foundedPlot.error_y.array = yValue;
  }

  foundedPlot.error_bands = foundedPlot.error_bands.filter(
    (errors) => errors.path !== normalizeIndices(nodeUri),
  );
  // Update error_bands by adding the new selected one
  foundedPlot.error_bands.push({
    path: normalizeIndices(nodeUri),
    yData: yData,
  });
};

/**
 * @description Format config to allow to call plotNodeUriLoaded
 * @param activeConfiguration The configuration to format
 */
export function formatConfigBeforeLoadingURIs(
  activeConfiguration: ConfigurationToSave | Configuration,
) {
  const newListDataGridPlot: DataGridPlot[] = activeConfiguration.dataPlot.map(
    (data): DataGridPlot => ({
      ...data,
      isEditing: false,
      static: false,
      coordinates:
        data.coordinates && data.coordinates.length > 0
          ? data.coordinates.map(
              (coord: BaseCoordinates, index): Coordinates => {
                return {
                  ...coord,
                  name: '',
                  shape: [],
                  coordinates: [],
                  data: [],
                  axeIndex: index,
                };
              },
            )
          : [],
      plot: data.plot.map((plot): DataPlotly => {
        // Update plot.nodeUri with selected URIs
        const splittedNodeUri = plot.nodeUri.split('#');
        if (plot.labelUri === splittedNodeUri[0]) {
          const uriToApply = activeConfiguration.dataURI.find(
            (uri: URIData) => plot.labelUri === uri.name,
          )?.uri;
          plot.nodeUri = uriToApply + '#' + splittedNodeUri[1];
        }

        return {
          ...plot,
          yData: [],
          x: [],
          y: [],
          unit: '',
        } as DataPlotly;
      }),
    }),
  );

  return newListDataGridPlot;
}

/**
 * @description Fetches data for each plot in the provided DataGridPlot from file configuration.
 * @param dataGridPlot The array of DataGridPlot objects to fetch data for.
 * @returns A promise that resolves to an array of updated DataGridPlot objects.
 */
export async function plotNodeUriLoaded(
  dataGridPlot: DataGridPlot[],
): Promise<DataGridPlot[]> {
  try {
    let errorHasOccurred = false;

    const updatedDataGridPlot: DataGridPlot[] = await Promise.all(
      dataGridPlot.map(async (dataGrid): Promise<DataGridPlot> => {
        const updatedXAxisData: Axis = dataGrid.xAxisData;

        const updatedPlot: DataPlotly[] = [];
        for (const plot of dataGrid.plot) {
          if (!plot.nodeUri) {
            updatedPlot.push(plot);
            continue;
          }

          try {
            const defaultUri = normalizeIndices(plot.nodeUri); // Normalize the URI to ensure it matches the expected format

            if (
              defaultUri.split('#')[0] !==
              dataGrid.plot[0].nodeUri.split('#')[0]
            ) {
              showNotification({
                title: 'Plot',
                message: 'Unable to plot data from different URIs',
                color: 'yellow',
              });
              continue;
            }

            const response = await fetchDataPlot(
              defaultUri,
              dataGrid?.downsampled_method,
              dataGrid?.downsampled_size,
            );
            if (!response || !response.data) {
              console.warn(`No data returned for nodeUri: ${plot.nodeUri}`);
              errorHasOccurred = true;
              updatedPlot.push(plot);
              continue;
            }

            let yResponsePath = response.data.path;

            const plotIndex = dataGrid.plot.findIndex(
              (plotFromList) => plotFromList.nodeUri === plot.nodeUri,
            );
            const matchingCoordList: Coordinates[] = [];
            for (const responseCoordinates of response.data.coordinates) {
              const matchingCoord: Coordinates = JSON.parse(
                JSON.stringify(dataGrid.coordinates),
              ).find(
                (c: Coordinates) =>
                  normalizeIndices(c.path) === responseCoordinates.path,
              );
              const lastField = getLastIndexedField(responseCoordinates.target);
              if (!lastField) continue;

              // If coordinates exist, update it with response from BE
              matchingCoord.data = responseCoordinates.value;
              matchingCoord.name = responseCoordinates.name;
              matchingCoord.path = getDefaultUri(responseCoordinates.path);
              matchingCoord.unit = responseCoordinates.unit || '';
              matchingCoord.shape = responseCoordinates.downsampled_shape;
              matchingCoord.coordinates = responseCoordinates.coordinates;

              //* Update the target - yPath - axis data with the index
              matchingCoord.target = updateIndexFieldName(
                matchingCoord.target,
                lastField,
                matchingCoord.valueIndex,
              );

              yResponsePath = updateIndexFieldName(
                yResponsePath,
                lastField,
                matchingCoord.valueIndex,
              );

              updatedXAxisData.path = updateIndexFieldName(
                updatedXAxisData.path,
                lastField,
                matchingCoord.valueIndex,
              );

              matchingCoordList.push(matchingCoord);
            }

            if (plotIndex === 0) {
              // Update datagrid coordinates with first plot response
              dataGrid.coordinates = matchingCoordList;
            }

            if (response.data.downsampled_method) {
              dataGrid.downsampled_method = response.data.downsampled_method;
            }

            // Save plot unit
            plot.unit = response.data.unit;

            let defaultXValue: number[] | string[] = [];
            if (response.data.coordinates.length > 0) {
              // Get x vector for each plot
              defaultXValue = getArrayValueFromDependance(matchingCoordList, 0);
            }
            const defaultYValue = getVectorData(
              dataGrid.coordinates,
              response.data.value,
            );

            const plotToPush = {
              ...plot,
              name: `${response.data.name}_${plot.labelUri}`,
              description: response.data.description,
              dimensions: response.data.ndim,
              path: yResponsePath,
              shape: response.data.downsampled_shape as number[],
              yData: response.data.value,
              x: defaultXValue,
              y: defaultYValue,
            } as DataPlotly;
            updatedPlot.push(plotToPush);
          } catch (error) {
            console.error(`Error fetching data for ${plot.nodeUri}:`, error);
            errorHasOccurred = true;
            updatedPlot.push(plot);
          }
        }

        const dataGridUpdated = {
          ...dataGrid,
          xAxisData: updatedXAxisData,
          plot: updatedPlot,
        } as DataGridPlot;

        return dataGridUpdated;
      }),
    );

    if (updatedDataGridPlot?.length) {
      // Get error bands for each plots of each dataPlots when loading a config
      for (const dataPlot of updatedDataGridPlot) {
        if (dataPlot.displayErrorBand) {
          // Get error bands only when displayErrorBand is switch on (info from config)
          for (const plot of dataPlot.plot) {
            const updatedDataPlot = updatedDataGridPlot.find(
              (d) => d.i === dataPlot.i,
            );
            await fetchErrorBands(
              updatedDataPlot, // dataPlot is updated directly from fetchErrorBands to include error bands
              plot.nodeUri,
            );
          }
        }

        // Apply range to coordinates, dependencies & new error bands when loading a config
        for (const coordinate of dataPlot.coordinates) {
          if (coordinate?.range) {
            const keepValueIndex = true;
            await applyRange(
              coordinate,
              coordinate.range,
              dataPlot,
              [...dataPlot.plot.map((plot) => plot.nodeUri)],
              keepValueIndex,
              true, // apply range origin when loading a config (get coordinates for first time)
            );
          }
        }
      }
    }

    if (errorHasOccurred) {
      showNotification({
        title: 'Plot',
        message: 'Some plots could not be loaded',
        color: 'red',
      });
    }
    // Return dataPlot list with error bands
    return updatedDataGridPlot;
  } catch (error) {
    console.error('Error in plotNodeUriLoaded:', error);
    showNotification({
      title: 'Plot',
      message: 'Failed to load plot data',
      color: 'red',
    });

    return dataGridPlot;
  }
}

/**
 * @description Retrieves vector data from a plot item based on the provided URI and coordinates.
 * @param uri The URI to retrieve the vector data from.
 * @param coordinates The coordinates to use for retrieving the vector data.
 * @param plotItem The plot item containing the yData to extract the vector from.
 * @returns The vector data as an array of numbers, or undefined if the indices are invalid
 */
export function getVectorData(coordinates: Coordinates[], yData: AxisData) {
  const coordinatesLength: number = coordinates.length;

  // Extract only matrix indexes
  const matrixIndexes = JSON.parse(JSON.stringify(coordinates))
    .sort(compareByAxeIndex)
    .reverse()
    .filter((coord: Coordinates) => coord.axeIndex !== 0)
    .map((coord: Coordinates) => coord.valueIndex);

  // Retrieve vector to plot
  /* eslint-disable  @typescript-eslint/no-explicit-any */
  let result: any = yData;
  let shapeIndex = 0;
  for (const index of matrixIndexes) {
    if (shapeIndex < coordinatesLength && index < result.length) {
      result = result[index];
      shapeIndex++;
    } else {
      if (!(shapeIndex < coordinatesLength)) {
        break;
      } else {
        console.warn('Impossible to plot: invalid index or incorrect length');
        return undefined;
      }
    }
  }
  const vectorData: number[] = result;
  return vectorData;
}

export function getErrorYVectors(plot: DataPlotly, coordinates: Coordinates[]) {
  // Get error bands vectors switch coordinates indexes
  const updated_error_y: ErrorBar = JSON.parse(JSON.stringify(plot.error_y));

  if (updated_error_y?.type === 'data') {
    if (updated_error_y?.arrayminus) {
      updated_error_y.arrayminus = getVectorData(
        coordinates,
        plot.error_bands.find((err_b) => err_b.path.endsWith('_error_lower'))
          .yData,
      );
    }
    const error_array_yData =
      plot.error_bands.find((err_b) => err_b.path.endsWith('_error_upper'))
        ?.yData ||
      plot.error_bands.find((err_b) => err_b.path.endsWith('_error_lower'))
        ?.yData;

    updated_error_y.array = getVectorData(coordinates, error_array_yData);
  }
  return updated_error_y;
}

/**
 * @description Compares two Coordinates objects by their axeIndex.
 * @param a The first Coordinates object.
 * @param b The second Coordinates object.
 * @returns A negative number if a's axeIndex is less than b's, a positive number if greater, or 0 if equal.
 */
export function compareByAxeIndex(a: Coordinates, b: Coordinates) {
  if (a.axeIndex < b.axeIndex) {
    return -1;
  } else if (a.axeIndex > b.axeIndex) {
    return 1;
  }
  return 0;
}

/**
 * @description
 * Checks whether a one-dimensional or two-dimensional array containing strings or numbers
 * has at least one valid (non-empty, non-null, non-NaN) value.
 * @param arr The input array to check. Can be either a 1D or 2D array of strings or numbers.
 * @returns `true` if at least one value is valid (not NaN, null, undefined, or an empty string), otherwise `false`.
 * @example
 * hasAtLeastOneValidValue([NaN, NaN, NaN]); // false
 * hasAtLeastOneValidValue(['', ' ', NaN]);  // false
 * hasAtLeastOneValidValue(['ok', NaN]);     // true
 * hasAtLeastOneValidValue([[NaN, ''], ['hello', NaN]]); // true
 */
export function hasAtLeastOneValidValue(arr: AxisData): boolean {
  if (Array.isArray(arr[0])) {
    // 2D table
    return (arr as (string | number)[][]).some(
      (subArr) => hasAtLeastOneValidValue(subArr), // appel récursif
    );
  }

  // Else, 1D table
  return (arr as (string | number)[]).some((v) => {
    if (v === null || v === undefined) return false;
    if (typeof v === 'number') return !Number.isNaN(v);
    if (typeof v === 'string') return v.trim() !== '';
    return false;
  });
}

/**
 * @description
 * Checks whether a matrix-like input (1D or 2D array of strings/numbers) is plottable
 * This function is designed to work well with array methods such as `.every()`
 * to validate multiple inputs (e.g., `[x, y, z].every(isMatrixPlottable)`).
 * @param value The matrix-like input to check.
 * @returns `true` if the matrix is plottable, otherwise `false`.
 * @example
 * isMatrixPlottable([[1, 2], [3, 4]]); // true
 * isMatrixPlottable([NaN, NaN]);       // false
 * isMatrixPlottable(undefined);        // false
 */
export function isMatrixPlottable(value: AxisData): boolean {
  if (value === undefined) return false;

  try {
    const tensor = tf.tensor(value);
    const shape = tensor.shape;
    const lastDim = shape[shape.length - 1];

    // Check if matrix is not empty & get at least one valide value
    return lastDim !== 0 && hasAtLeastOneValidValue(value);
  } catch {
    // If tensor fails (irregular shape, etc.)
    return false;
  }
}

/**
 * Replace recursively all `null` or `undefined` by `NaN`.
 * Works for AxisData of dimension 1D, 2D or 3D.
 *
 * @param arr - Array which could contain nulls or undefined
 * @returns New array with NaN instead of null/undefined
 */
function replaceNullsWithNaN(arr: AxisData): AxisData {
  if (Array.isArray(arr)) {
    /* eslint-disable  @typescript-eslint/no-explicit-any */
    return arr.map((v: any) => {
      return Array.isArray(v) ? replaceNullsWithNaN(v as AxisData) : (v ?? NaN);
    }) as AxisData;
  }

  // 1D Case
  return arr ?? NaN;
}

/**
 * Return a tensorized matrix using tensorflow
 * @param matrix
 * @returns
 */
export const getTensorizedMatrix = async (matrix: AxisData) => {
  const matrixWithNaN = replaceNullsWithNaN(matrix);
  const shape = getMaxShape(matrixWithNaN);
  const reshapedMatrix = reshapeMatrix(matrixWithNaN, shape);
  const dataTensorized = tf.tensor(reshapedMatrix);
  return dataTensorized;
};

export const swapAxis = async (
  itemDataGrid: DataGridPlot,
  axeIndexToSwap: number,
  axeIndexOfTargetAxis: number,
  active?: Configuration,
  updatedConfiguration?: (configuration: Configuration) => void,
) => {
  // Get indexes to swap
  const actualTargetAxisIndex: number = itemDataGrid.coordinates.findIndex(
    (coordinate) => coordinate.axeIndex === axeIndexOfTargetAxis,
  );
  const itemToSwitchIndex: number = itemDataGrid.coordinates.findIndex(
    (coordinate) => coordinate.axeIndex === axeIndexToSwap,
  );

  const updatedDataPlotList: DataGridPlot[] =
    active && updatedConfiguration
      ? JSON.parse(JSON.stringify(active.dataPlot))
      : null;
  const updatedDataPlot = updatedDataPlotList
    ? updatedDataPlotList.find(
        (dataPlotToUpdate) => dataPlotToUpdate.i === itemDataGrid.i,
      )
    : (JSON.parse(JSON.stringify(itemDataGrid)) as DataGridPlot);

  // Swap axis
  updatedDataPlot.coordinates[actualTargetAxisIndex].axeIndex = axeIndexToSwap;
  updatedDataPlot.coordinates[itemToSwitchIndex].axeIndex =
    axeIndexOfTargetAxis;

  // Reset indexValue
  updatedDataPlot.coordinates[actualTargetAxisIndex].valueIndex = 0;
  updatedDataPlot.coordinates[itemToSwitchIndex].valueIndex = 0;

  // Update all coordinates targets & paths impacted with resetted indexValue
  const actualXAxisTargetLastName = getLastIndexedField(
    updatedDataPlot.coordinates[actualTargetAxisIndex].target,
  );
  const itemToSwitchTargetLastName = getLastIndexedField(
    updatedDataPlot.coordinates[itemToSwitchIndex].target,
  );
  const actualXAxisupdatedPath = updateIndexFieldName(
    updatedDataPlot.coordinates[actualTargetAxisIndex].target || '',
    actualXAxisTargetLastName,
    0,
  );
  updateIndexFieldName(actualXAxisupdatedPath, itemToSwitchTargetLastName, 0);
  const itemToSwitchupdatedPath = updateIndexFieldName(
    updatedDataPlot.coordinates[itemToSwitchIndex].target || '',
    itemToSwitchTargetLastName,
    0,
  );
  updateIndexFieldName(itemToSwitchupdatedPath, actualXAxisTargetLastName, 0);

  // Modify targets from each coordinates
  for (const coordinate of updatedDataPlot.coordinates) {
    coordinate.target = updateIndexFieldName(
      coordinate.target || '',
      itemToSwitchTargetLastName,
      0,
    );
    coordinate.target = updateIndexFieldName(
      coordinate.target,
      actualXAxisTargetLastName,
      0,
    );

    coordinate.path = updateIndexFieldName(
      coordinate.path || '',
      itemToSwitchTargetLastName,
      0,
    );
    coordinate.path = updateIndexFieldName(
      coordinate.path,
      actualXAxisTargetLastName,
      0,
    );
  }

  // Set new xAxis plot
  const xIndex: number = updatedDataPlot.coordinates.findIndex(
    (coordinate) => coordinate.axeIndex === 0,
  );
  updatedDataPlot.xAxisData.name = updatedDataPlot.coordinates[xIndex].name;
  updatedDataPlot.xAxisData.path = updatedDataPlot.coordinates[xIndex].path;
  updatedDataPlot.xAxisData.unit = updatedDataPlot.coordinates[xIndex].unit;

  // Transpose yData with resetted valueIndex
  await transposeAxis(updatedDataPlot, axeIndexToSwap, axeIndexOfTargetAxis);

  // Update x & y with translated dataY
  for (const plot of updatedDataPlot.plot) {
    const vectorData = getVectorData(updatedDataPlot.coordinates, plot.yData);
    plot.y = vectorData;
    // Get x values switch x dependances
    plot.x = getArrayValueFromDependance(updatedDataPlot.coordinates, 0);

    if (plot?.error_bands?.length) {
      // Update error_y vectors after transpositions
      const swapped_error_y = getErrorYVectors(
        plot,
        updatedDataPlot.coordinates,
      );
      plot.error_y = swapped_error_y;
    }
  }

  // Limit coordinate sliders to the max of their new shape
  limitSlidersToMaxLength(updatedDataPlot.coordinates);

  if (active && updatedConfiguration) {
    const updatedActive = {
      ...active,
      dataPlot: updatedDataPlotList,
    };
    updatedConfiguration(updatedActive);
  }

  return updatedDataPlot;
};

/**
 * Update coordinates to limit sliders to maximum length.
 * @param coordinates The coordinates to check and update if necessary.
 */
export function limitSlidersToMaxLength(coordinates: Coordinates[]) {
  for (const coord of coordinates) {
    const coordLength = getArrayValueFromDependance(
      coordinates,
      coord.axeIndex,
    )?.length;
    if (coordLength && coord.valueIndex > coordLength - 1) {
      coord.valueIndex = coordLength - 1;
    }
  }
}

/**
 * Find the maximum shape of a potentially irregular array.
 */
function getMaxShape(arr: any[]): number[] {
  const shape: number[] = [];

  function goThrough(node: any, depth: number) {
    if (!Array.isArray(node)) return;

    // Update max shape to this length
    shape[depth] = Math.max(shape[depth] ?? 0, node.length);

    for (const item of node) {
      goThrough(item, depth + 1);
    }
  }

  goThrough(arr, 0);
  return shape;
}

/**
 * Recursively fills an irregular array with NaN
 * to match a given shape.
 */
function reshapeMatrix(arr: any[], shape: number[], depth = 0): any[] {
  const size = shape[depth];
  const result = [...arr];

  for (let i = 0; i < size; i++) {
    if (result[i] === undefined) {
      // If an element is missing, either NaN or a subarray filled with NaN is inserted
      if (shape.length > depth + 1) {
        result[i] = reshapeMatrix([], shape, depth + 1);
      } else {
        result[i] = NaN;
      }
    } else if (Array.isArray(result[i])) {
      result[i] = reshapeMatrix(result[i], shape, depth + 1);
    }
  }

  return result;
}

async function transposeMatrix(yData: AxisData, newPositions: number[]) {
  // Transpose dataY
  const tensor = await getTensorizedMatrix(yData);
  const dataTransposed = tensor.transpose(newPositions);
  return dataTransposed;
}

async function transposeAxis(
  updatedDataPlot: DataGridPlot,
  axeIndexToSwap: number,
  axeIndexOfTargetAxis: number,
) {
  // Modify each plot in graph
  for (const plotToTranspose of updatedDataPlot.plot) {
    // DETERMINE WHICH AXIS TO TRANSPOSE
    // Initial position
    const newPositions: number[] = JSON.parse(
      JSON.stringify(updatedDataPlot.coordinates),
    )
      .map((coord: Coordinates) => coord.axeIndex)
      .sort()
      .reverse(); // Reverse to get axeIndex order
    // SWAP axeIndexOfTargetAxis with axeIndexToSwap
    const tempSwap = newPositions[axeIndexOfTargetAxis];
    newPositions[axeIndexOfTargetAxis] = newPositions[axeIndexToSwap];
    newPositions[axeIndexToSwap] = tempSwap;
    // Reverse for getting position => [0, 1, 3, 2]
    newPositions.reverse();

    // Transpose dataY matrix
    const tensorizedDataY = await transposeMatrix(
      plotToTranspose.yData,
      newPositions,
    );
    const transposedDataY = (await tensorizedDataY.array()) as AxisData;
    plotToTranspose.yData = transposedDataY;
    plotToTranspose.shape = tensorizedDataY.shape;

    if (
      plotToTranspose?.error_bands &&
      plotToTranspose?.error_y &&
      plotToTranspose.error_y.type === 'data'
    ) {
      for (const error_band of plotToTranspose.error_bands) {
        if (!isMatrixPlottable(error_band.yData)) {
          // Control to prevent from transposing error y axis when unplottable data
          continue;
        }
        // Transpose each error band matrix
        const tensorizedErrorBand = await transposeMatrix(
          error_band.yData,
          newPositions,
        );
        const transposedErrorBand =
          (await tensorizedErrorBand.array()) as AxisData;
        error_band.yData = transposedErrorBand;
      }
    }
  }
}

/**
 * Reduce size of a coordinate data by slicing to the range provided
 * @param coordinates
 * @param coordNameToUpdate
 * @param newRange
 * @param dependencyIndex optional: determined the shape index of the dependency
 * @param shouldApplyRangeOriginInCoord optional: determine if it's a new range to be applied to the data (begin to the range instead of 0)
 * @returns Return the sliced data
 */
const trimCoordData = async (
  coordinates: Coordinates[],
  coordNameToUpdate: string,
  newRange: [number, number],
  oldRange: [number, number],
  dependencyIndex?: number,
  shouldApplyRangeOriginInCoord?: boolean,
) => {
  const updatedCoord = coordinates.find(
    (coord) => coord.name === coordNameToUpdate,
  );
  const dataRangeMin = newRange[0];
  const dataRangeMax = newRange[1];

  const dataTensorized = await getTensorizedMatrix(updatedCoord.data);

  // Get new shape to apply
  const shapeIndex = dependencyIndex ?? dataTensorized.shape.length - 1;
  const minRangeOrigin = oldRange ? oldRange[0] : 0;
  const originShape = dataTensorized.shape.map((el, index) =>
    index === shapeIndex
      ? shouldApplyRangeOriginInCoord
        ? minRangeOrigin
        : dataRangeMin - minRangeOrigin
      : 0,
  );
  const shapeSize = dataTensorized.shape.map((el, index) =>
    index === shapeIndex ? dataRangeMax + 1 - dataRangeMin : el,
  );

  if (dependencyIndex === undefined) {
    // Update the new range when updating the main coordinate
    updatedCoord.range = newRange;
  }

  return tf.slice(dataTensorized, originShape, shapeSize);
};

/**
 * Trim a plot data
 * @param updatedPlot
 * @param coordinates
 * @param axeIndexToUpdate
 * @param newRange
 * @param oldRange
 * @returns
 */
const trimPlotData = async (
  updatedPlot: DataPlotly | ErrorBandData,
  coordinates: Coordinates[],
  axeIndexToUpdate: number,
  newRange: [number, number],
  oldRange?: [number, number],
) => {
  const dataRangeMin = newRange[0];
  const dataRangeMax = newRange[1];

  // Reshape matrix with NaN instead of null (to prevent from replacing them by 0)
  const dataTensorized = await getTensorizedMatrix(updatedPlot.yData);

  // Get new shape to apply
  const reversedCoords = JSON.parse(JSON.stringify(coordinates))
    .sort(compareByAxeIndex)
    .reverse() as Coordinates[];
  const shapeIndex = reversedCoords.findIndex(
    (coord) => coord.axeIndex === axeIndexToUpdate,
  );
  const minRangeOrigin = oldRange ? oldRange[0] : 0;
  const originShape: number[] = dataTensorized.shape.map((el, index) =>
    index === shapeIndex ? dataRangeMin - minRangeOrigin : 0,
  );
  const shapeSize = dataTensorized.shape.map((el, index) =>
    index === shapeIndex ? dataRangeMax + 1 - dataRangeMin : el,
  );

  return tf.slice(dataTensorized, originShape, shapeSize);
};

/**
 * Format trimmed coordinate by updating all concerned data (data, shape, downsampled_shape, valueIndex, target, path)
 * @param updatedCoord
 * @param trimmed
 * @param coordinateAffectingDependency
 */
const formatTrimmedCoordinate = async (
  updatedCoord: Coordinates,
  trimmed: tf.Tensor<tf.Rank>,
  coordinateAffectingDependency?: Coordinates,
  keepValueIndex?: boolean,
) => {
  const depValues = (await trimmed.array()) as AxisData;
  // Update data
  updatedCoord.data = depValues;

  // Update shapes
  updatedCoord.shape = trimmed.shape;

  if (!keepValueIndex) {
    // Update valueIndex, target & path
    updatedCoord.valueIndex = 0;
    const lastTargetLastName = getLastIndexedField(
      coordinateAffectingDependency?.target ?? updatedCoord.target,
    );
    const updatedPath = updateIndexFieldName(
      updatedCoord.path,
      lastTargetLastName,
      0,
    );
    const updatedTarget = updateIndexFieldName(
      updatedCoord.target,
      lastTargetLastName,
      0,
    );
    updatedCoord.path = updatedPath;
    updatedCoord.target = updatedTarget;
  }
};

export const applyRange = async (
  coordinate: Coordinates,
  newRange: [number, number],
  customizedDataGrid: DataGridPlot,
  newPlotsUri?: string[],
  keepValueIndex?: boolean,
  shouldApplyRangeOriginInCoord?: boolean,
) => {
  try {
    const updatedDataPlot = customizedDataGrid;
    const coordinates = JSON.parse(
      JSON.stringify(updatedDataPlot.coordinates),
    ) as Coordinates[];
    const oldRange = coordinates.find(
      (coord) => coord.axeIndex === coordinate.axeIndex,
    )?.range;

    // Trim coordinate
    await applyRangeInCoord(
      updatedDataPlot.coordinates,
      coordinate.name,
      newRange,
      oldRange,
      keepValueIndex,
      shouldApplyRangeOriginInCoord,
    );

    // Trim plots
    await applyRangeInPlot(
      updatedDataPlot.coordinates,
      updatedDataPlot.plot,
      coordinate.axeIndex,
      newRange,
      oldRange,
      newPlotsUri,
    );

    return {
      ...customizedDataGrid,
      coordinates: updatedDataPlot.coordinates,
      plot: updatedDataPlot.plot,
    } as DataGridPlot;
  } catch (error) {
    console.error('Error applying the range: ', error);
  }
};

export async function applyRangeInCoord(
  updatedCoords: Coordinates[],
  coordNameToUpdate: string,
  newRange: [number, number],
  oldRange: [number, number],
  keepValueIndex?: boolean,
  shouldApplyRangeOriginInCoord?: boolean,
) {
  const updatedCoord = updatedCoords.find(
    (coord) => coord.name === coordNameToUpdate,
  );
  const coordinate = JSON.parse(JSON.stringify(updatedCoord));

  // Trim coordinate.data
  const trimmed = await trimCoordData(
    updatedCoords,
    updatedCoord.name,
    newRange,
    oldRange,
    undefined,
    shouldApplyRangeOriginInCoord,
  );
  // Format coordinate with trimmed data
  await formatTrimmedCoordinate(
    updatedCoord,
    trimmed,
    undefined,
    keepValueIndex,
  );

  // Trim coordinates having dependencies
  for (const coordDependencie of updatedCoords) {
    if (coordDependencie.name === coordinate.name) {
      // Don't check dependencies of updated coordinate
      continue;
    }

    const dependencyIndex = (
      JSON.parse(JSON.stringify(coordDependencie.coordinates)) as string[]
    )
      .reverse() // We reverse dependencies to get dependency index in the order of the matrix
      .findIndex((dep) => dep === coordinate.name);
    if (dependencyIndex === -1) {
      // No dependencies with updated coordinate
      continue;
    }

    const trimmedDep = await trimCoordData(
      updatedCoords,
      coordDependencie.name,
      newRange,
      oldRange,
      dependencyIndex,
      shouldApplyRangeOriginInCoord,
    );
    await formatTrimmedCoordinate(
      coordDependencie,
      trimmedDep,
      updatedCoord,
      keepValueIndex,
    );
  }
}

export async function applyRangeInPlot(
  coordinates: Coordinates[],
  updatedPlots: DataPlotly[],
  axeIndexToUpdate: number,
  newRange: [number, number],
  oldRange?: [number, number],
  newPlotsUri?: string[],
) {
  for (const updatedPlot of updatedPlots) {
    // Update plot.x with trimmed coordinates
    const newX = getArrayValueFromDependance(coordinates, 0);
    updatedPlot.x = newX;

    let rangeAlreadyAppliedInPlot = true;
    if (newPlotsUri && newPlotsUri.includes(updatedPlot.nodeUri)) {
      // Boolean used for determined if range has already been applied in this plot
      rangeAlreadyAppliedInPlot = false;
    }

    // Trim plot.yData
    const trimmed = await trimPlotData(
      updatedPlot,
      JSON.parse(JSON.stringify(coordinates)),
      axeIndexToUpdate,
      newRange,
      rangeAlreadyAppliedInPlot === true ? oldRange : null,
    );
    const newYData = (await trimmed.array()) as AxisData;
    updatedPlot.yData = newYData;
    updatedPlot.shape = trimmed.shape;

    // Update plot.y with trimmed plot.yData
    const newY = getVectorData(coordinates, updatedPlot.yData);
    updatedPlot.y = newY;

    // Trim error bands if existing
    if (updatedPlot?.error_bands) {
      for (const error_band of updatedPlot.error_bands) {
        if (
          updatedPlot.error_y.type === 'data' &&
          ((error_band.path.endsWith('_error_upper') &&
            updatedPlot.error_y.array.length === 0) ||
            (error_band.path.endsWith('_error_lower') &&
              updatedPlot.error_y.arrayminus.length === 0))
        ) {
          continue;
        }
        const upperOrLower = error_band.path.endsWith('_error_upper')
          ? '_error_upper'
          : '_error_lower';
        if (
          newPlotsUri &&
          newPlotsUri.includes(updatedPlot.nodeUri + upperOrLower)
        ) {
          // Check if error band has already been applied
          rangeAlreadyAppliedInPlot = false;
        }

        const trimmed = await trimPlotData(
          error_band,
          JSON.parse(JSON.stringify(coordinates)),
          axeIndexToUpdate,
          newRange,
          rangeAlreadyAppliedInPlot === true ? oldRange : null,
        );
        const newYData = (await trimmed.array()) as AxisData;
        error_band.yData = newYData;
      }
      const swapped_error_y = getErrorYVectors(updatedPlot, coordinates);
      updatedPlot.error_y = swapped_error_y;
    }
  }
}
