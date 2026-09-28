import { showNotification } from '@mantine/notifications';
import {
  Axis,
  AxisData,
  BaseCoordinates,
  BaseDataPlotly,
  Configuration,
  ConfigurationToSave,
  Coordinates,
  DataGridPlot,
  DataOperation,
  DataPlotly,
  Datum,
  Geometry,
  FieldValueResponse,
  NodeInfoTypeEnum,
  PlotCoordinatesResponse,
  PlotDataResponse,
  PlotLine,
  URIData,
  URITreeNodeData,
  GeometryInfos,
} from '../types';
import { Layout, LayoutAxis, ScatterData } from 'plotly.js';
import {
  buildSmoothingRequest,
  fetchDataPlot,
  fetchFieldValue,
  formatOperations,
  formatSignalOperations,
  isSignalOperation,
} from './fetchData';
import { generateNewGridPlot } from './grid';
import {
  getDefaultUri,
  getLastIndexedField,
  normalizeIndices,
  updateIndexFieldName,
} from './uri';
import {
  compareByAxeIndex,
  getArrayValueFromDependance,
  getFirstArrayValueFromShape,
  getVectorData,
} from './matrix';
import { containsFloat, removeSuffix, rgbToRgba } from './functions';
import { cloneGridStructure } from './cloneGrid';
import { getMaxShape, getTensorizedMatrix } from './tensor';
import {
  Ranges,
  baseOf,
  payloadShape,
  readPayload,
  registerPayload,
  transposeOf,
  transposedKey,
} from '../stores/payloadRegistry';
import { baseRank, sliceFromBase } from '../derive/ranges';
import {
  axisVector,
  bandVectors,
  customdataOf,
  lineVector,
} from '../derive/vectors';

const defaultColorsRGB = [
  'rgb(31, 119, 180)',
  'rgb(255, 127, 14)',
  'rgb(44, 160, 44)',
  'rgb(214, 39, 40)',
  'rgb(148, 103, 189)',
  'rgb(140, 86, 75)',
];

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
  /** Only its emptiness is read, to warn that a node holds nothing to draw. */
  yValue: number[],
  yData: AxisData,
  nodeUri: string,
  dimensions: number,
  path: string,
  shape: number[],
  labelUri: string,
  unit: string,
  downsampled_method: string,
  interpolated_method: string,
  description?: string,
  y2Axis?: boolean,
  yDataRef?: string,
): DataGridPlot => {
  const trace: DataPlotly = {
    yData: yData,
    yDataRef: yDataRef,
    name: name ? `${name}_${labelUri}` : '',
    line: {},
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
    interpolated_method: interpolated_method,
    plot: [...currentPlot, trace],
    forceXyRatio: dataPlot?.forceXyRatio ?? false,
  };
};

/**
 * @description Computes the default axis-ratio rule for a newly created grid, based on the 2D
 * rule: force a 1:1 ratio only when the first two coordinate axes (x and y) share the same,
 * non-empty unit. Returns false for mono-coordinate (1D) plots.
 * @param coordinates The coordinates of the created grid.
 * @returns Whether the x/y ratio should be forced by default.
 */
export const computeDefaultForceXyRatio = (
  coordinates: Coordinates[],
): boolean => {
  const firstCoordinateUnit = coordinates.find((c) => c.axeIndex === 0)?.unit;
  const secondCoordinateUnit = coordinates.find((c) => c.axeIndex === 1)?.unit;
  return !!firstCoordinateUnit && firstCoordinateUnit === secondCoordinateUnit;
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

  const response: PlotDataResponse = await fetchDataPlot(
    defaultUri,
    undefined,
    undefined,
    nodes[0].type,
  );
  defaultUri = getDefaultUri(defaultUri); //Set defaultUri [0] by default

  let formattedCoordinates: Coordinates[] = [];
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
    formattedCoordinates = formatCoordinates(response.data.coordinates, 0);
  }

  // Set the yAxis properties
  const yAxis: Axis = {
    name: response.data.name,
    unit: response.data.unit,
  };

  const newGrid = generateNewGridPlot(
    formattedCoordinates,
    xAxis,
    yAxis,
    updatedActive.dataPlot || [],
    nodes[0],
  );

  const defaultYValue = getFirstArrayValueFromShape(
    response.data.value,
    response.data.shape as number[],
  );

  const updatedPlot: DataGridPlot = plotData(
    newGrid,
    yAxis.name,
    defaultYValue,
    response.data.value,
    defaultUri,
    response.data.ndim,
    getDefaultUri(response.data.path),
    response.data.shape as number[],
    nodes[0].name,
    response.data.unit,
    response.data.downsampled_method,
    response.data.interpolated_method,
    response.data.description,
    undefined,
    response.data.valueRef,
  );
  updatedPlot.dataType = nodes[0].type;
  updatedPlot.is_geometry_node = nodes[0].is_geometry_node;

  // Initialize the axis-ratio rule from the 2D rule (matching x/y coordinate units)
  updatedPlot.forceXyRatio = computeDefaultForceXyRatio(
    updatedPlot.coordinates,
  );

  // Rule to define the default plot mode
  updatedPlot.selectedPlotMode =
    updatedPlot.coordinates.length >= 2 &&
    containsFloat(updatedPlot.coordinates[1]?.data)
      ? 'Heatmap'
      : '1D';

  updatedActive.dataPlot.push(updatedPlot);
  return updatedActive;
};

/**
 * Update DataGridPlot provided by including interpolation with the newest plot. In delete case, interpolate without the deleted one.
 * @param findDataPlot
 * @param mainUri
 * @param nodeType Optional parameter used in add case to get data from BE
 */
const updateInterpolatedPlots = async (
  findDataPlot: DataGridPlot,
  mainUri: string,
  nodeType?: NodeInfoTypeEnum,
) => {
  // A structural copy: every field below is reassigned, never written into,
  // so the payloads can stay shared.
  let interpolatedDataPlot = cloneGridStructure(findDataPlot);
  const isInDeleteCase = !nodeType;
  let formattedCoordinates: Coordinates[];
  const urisToInterpolate = getUrisToInterpolate(
    mainUri,
    interpolatedDataPlot.plot,
  );

  if (!isInDeleteCase) {
    // In add case we add main uri in list of dependencies because we update plots interpolable with it
    urisToInterpolate.push(mainUri);
  }
  let plotsUpdated = 0;
  for (const plot of interpolatedDataPlot.plot) {
    if (!urisToInterpolate.includes(normalizeIndices(plot.nodeUri))) {
      continue;
    }
    plotsUpdated++;

    // Update all plots with the interpolation parameter
    const plotInterpolated = await fetchDataPlot(
      normalizeIndices(plot.nodeUri),
      interpolatedDataPlot?.downsampled_method,
      interpolatedDataPlot?.downsampled_size,
      nodeType,
      urisToInterpolate.filter((uri) => uri !== normalizeIndices(plot.nodeUri)),
      interpolatedDataPlot?.interpolated_method,
    );

    if (plotsUpdated === 1 && isInDeleteCase) {
      // In delete case the updated data without interpolation is in this function, so we need to update valueIndex here
      formattedCoordinates = formatCoordinates(
        plotInterpolated.data.coordinates,
        0,
      );

      formattedCoordinates = updateCoordsAfterInterpolation(
        interpolatedDataPlot.coordinates,
        formattedCoordinates,
      );

      // Update common coordinates to the new interpolation in delete case
      for (const [index, coord] of interpolatedDataPlot.coordinates.entries()) {
        if (coord?.rangeValues)
          formattedCoordinates[index].rangeValues = coord.rangeValues;
      }
      interpolatedDataPlot.coordinates = formattedCoordinates;
    }

    plot.yData = plotInterpolated.data.value;
    plot.yDataRef = plotInterpolated.data.valueRef;
    plot.shape = plotInterpolated.data.downsampled_shape;

    if (isInDeleteCase) {
      // Fit the refetched trace to the windows the grid already has. The ranges
      // are absolute, so this does not need to know which traces were narrowed.
      interpolatedDataPlot = await applyRangesToGrid(interpolatedDataPlot);
    }
  }
  return interpolatedDataPlot;
};

/**
 * Get uri list to base interpolation on in order to get interpolate_over param when calling fetchDataPlot with interpolation
 * @param uriToAdd
 * @param plots
 */
export const getUrisToInterpolate = (uriToAdd: string, plots: DataPlotly[]) => {
  const getPath = (uri: string) => normalizeIndices(uri).split('#')[1] ?? '';

  const normalizedUriToAdd = normalizeIndices(uriToAdd);
  const targetPath = getPath(normalizeIndices(uriToAdd));

  const urisToInterpolate = [
    ...new Set(
      plots
        .map((plot) => normalizeIndices(plot.nodeUri))
        .filter(
          (uri) =>
            getPath(uri) === targetPath &&
            normalizeIndices(uri) !== normalizedUriToAdd,
        ),
    ),
  ];

  return urisToInterpolate;
};

const updateCoordsAfterInterpolation = (
  oldCoords: Coordinates[],
  newCoords: Coordinates[],
) => {
  // Only `valueIndex` and `axeIndex` change: copy the coordinates, not their data.
  const interpolatedCoords = newCoords.map((coord) => ({ ...coord }));
  for (const [index, newCoord] of interpolatedCoords.entries()) {
    const oldCoord = oldCoords[index];
    const wantedValue = getArrayValueFromDependance(
      oldCoords,
      oldCoord.axeIndex,
    )[oldCoord.valueIndex];

    // Replace valueIndex with the new coordinates
    const newIndex = getArrayValueFromDependance(
      interpolatedCoords,
      newCoord.axeIndex,
    ).findIndex((nc) => nc === wantedValue);
    newCoord.valueIndex = newIndex === -1 ? 0 : newIndex;

    // Update axeIndex to preserve the transposition
    newCoord.axeIndex = oldCoord.axeIndex;
  }
  return interpolatedCoords;
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
    // Delete a plot
    return await deleteExistingPlot(nodes, findDataPlot, updatedActive);
  }

  for (const node of dataToPlot) {
    let defaultUri = node.uri;
    const urisToInterpolate = getUrisToInterpolate(
      defaultUri,
      findDataPlot.plot,
    );

    // For each dataPlot call fetchDataPlot to get data from BE
    const response = await fetchDataPlot(
      defaultUri,
      findDataPlot?.downsampled_method,
      findDataPlot?.downsampled_size,
      node.type,
      urisToInterpolate,
      findDataPlot?.interpolated_method,
    );

    // Update the common coordinates from interpolation
    const formattedCoordinates = formatCoordinates(
      response.data.coordinates,
      0,
    );
    for (const [index, coord] of findDataPlot.coordinates.entries()) {
      if (coord?.rangeValues)
        formattedCoordinates[index].rangeValues = coord.rangeValues;
      if (coord?.valueIndex)
        formattedCoordinates[index].valueIndex = coord.valueIndex;
    }

    // Get the common coordinates after interpolation
    const interpolatedCoordinates = updateCoordsAfterInterpolation(
      findDataPlot.coordinates,
      formattedCoordinates,
    );
    const partiallyInterpolatedDataPlot: DataGridPlot = {
      ...cloneGridStructure(findDataPlot),
      coordinates: interpolatedCoordinates,
    };

    // Interpolate all plots
    const interpolatedDataPlot = await updateInterpolatedPlots(
      partiallyInterpolatedDataPlot,
      defaultUri,
      node.type,
    );

    defaultUri = getDefaultUri(defaultUri); //Set defaultUri [0] by default
    const unit = response.data.unit;
    const unitExists =
      interpolatedDataPlot.yAxisData.unit === unit ||
      (interpolatedDataPlot.y2AxisData &&
        interpolatedDataPlot.y2AxisData.unit === unit);

    const xAxis = interpolatedDataPlot.xAxisData;
    const coordsResponse = response.data.coordinates;

    const sliderExist =
      interpolatedDataPlot.coordinates &&
      interpolatedDataPlot.coordinates.length > 0 &&
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
        const matchingCoord = interpolatedDataPlot.coordinates.find(
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
      interpolatedDataPlot.coordinates.length === coordsResponse.length &&
      [...interpolatedDataPlot.coordinates]
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
        coordsResponse.slice(1).length ==
          interpolatedDataPlot.coordinates.length &&
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

    // Update coordinates to have a common one with interpolation (once we have checked that we can display the new plot)
    findDataPlot.coordinates = interpolatedDataPlot.coordinates;
    findDataPlot.plot = interpolatedDataPlot.plot;

    const yAxis: Axis = {
      name: response.data.name,
      unit: unit,
    };

    const defaultYValue = getVectorData(
      findDataPlot.coordinates,
      response.data.value,
    );

    let updatedPlot: DataGridPlot;
    if (unitExists) {
      updatedPlot = await plotData(
        findDataPlot,
        yAxis.name,
        defaultYValue,
        response.data.value,
        defaultUri,
        response.data.ndim,
        yDataResponsePath,
        response.data.downsampled_shape as number[],
        node.name,
        response.data.unit,
        response.data.downsampled_method,
        response.data.interpolated_method,
        response.data.description,
        undefined,
        response.data.valueRef,
      );
    } else if (!findDataPlot.y2AxisData) {
      findDataPlot.y2AxisData = {
        name: yAxis.name,
        unit: unit,
      };

      updatedPlot = await plotData(
        findDataPlot,
        yAxis.name,
        defaultYValue,
        response.data.value,
        defaultUri,
        response.data.ndim,
        yDataResponsePath,
        response.data.downsampled_shape as number[],
        node.name,
        response.data.unit,
        response.data.downsampled_method,
        response.data.interpolated_method,
        response.data.description,
        true,
        response.data.valueRef,
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
    const areCombinedCoordinates = urisToInterpolate.length;
    if (areCombinedCoordinates) {
      // Update all error bands when we have combined coordinates
      for (const plot of updatedPlot.plot) {
        await fetchErrorBands(updatedPlot, plot.nodeUri);
      }
    } else {
      // Only get error bands of added plot when we don't have combined coordinates
      await fetchErrorBandsInConfig(updatedActive, defaultUri, findDataPlot.i);
    }

    // Fit the trace and its error bands to the windows the grid already has
    updatedPlot = await applyRangesToGrid(updatedPlot);
  }

  return updatedActive;
};

/**
 * @description When every plot of the grid sits on the same y axis, promote that
 * axis to the primary one and drop the secondary one.
 * @param dataGrid The grid to collapse, updated in place
 */
export const collapseYAxes = (dataGrid: DataGridPlot) => {
  const plots = dataGrid.plot;
  if (!plots?.length) return;
  if (!plots.every((plot) => plot.yaxis === plots[0].yaxis)) return;

  dataGrid.yAxisData =
    plots[0].yaxis === 'y2' ? dataGrid.y2AxisData : dataGrid.yAxisData;
  dataGrid.y2AxisData = undefined;

  for (const plot of plots) {
    plot.yaxis = '';
  }
};

/**
 * @description Re-assign a plot to a y axis after its unit changed, following the
 * same rule as when a plot is added from the tree: keep it on the axis carrying
 * its unit, or open the secondary axis when it is still free.
 * @param dataGrid The grid to update in place
 * @param plot The plot whose unit changed, updated in place
 * @param newUnit The unit returned by the back-end
 * @returns false when a third y axis would be needed, the grid is then untouched
 */
export const resolveYAxisForUnit = (
  dataGrid: DataGridPlot,
  plot: DataPlotly,
  newUnit: string,
): boolean => {
  if (newUnit === dataGrid.yAxisData?.unit) {
    plot.yaxis = '';
  } else if (dataGrid.y2AxisData && newUnit === dataGrid.y2AxisData.unit) {
    plot.yaxis = 'y2';
  } else if (!dataGrid.y2AxisData) {
    dataGrid.y2AxisData = {
      // A name is required, the axis title is not displayed without it
      name: removeSuffix(plot.name, '_' + plot.labelUri),
      unit: newUnit,
    };
    plot.yaxis = 'y2';
  } else {
    // Both axes are taken by other units: the grid is limited to two of them
    return false;
  }

  plot.unit = newUnit;
  collapseYAxes(dataGrid);

  // Hand back new axis objects: the axis titles are rebuilt by effects watching
  // the identity of yAxisData / y2AxisData, not the y axis of each plot
  dataGrid.yAxisData = dataGrid.yAxisData && { ...dataGrid.yAxisData };
  dataGrid.y2AxisData = dataGrid.y2AxisData && { ...dataGrid.y2AxisData };

  return true;
};

/**
 * @description Updates existing plot if deselected nodes match the plot's nodes.
 * @param nodes The nodes to update plots for.
 * @param findDataPlot The data plot to find and update.
 * @param updatedActive The updated active configuration.
 * @returns The updated active configuration.
 */
const deleteExistingPlot = async (
  nodes: URITreeNodeData[],
  findDataPlot: DataGridPlot,
  updatedActive: Configuration,
): Promise<Configuration> => {
  const plots = findDataPlot?.plot.filter((plot: DataPlotly) =>
    nodes.some(
      (node: URITreeNodeData) =>
        node.uri === normalizeIndices(plot.nodeUri) &&
        node.name === plot.labelUri,
    ),
  );

  const deletedPlot = findDataPlot?.plot.find(
    (plot: DataPlotly) =>
      !nodes.some(
        (node: URITreeNodeData) =>
          node.uri == normalizeIndices(plot.nodeUri) &&
          node.name === plot.labelUri,
      ),
  );

  findDataPlot.plot = plots;
  collapseYAxes(findDataPlot);

  findDataPlot.title = findDataPlot.isTitleOverwritten
    ? findDataPlot.title
    : plots.map((plot) => plot.name).join('/');

  // Update all plots with interpolation here (in delete case)
  const interpolatedDataPlot = await updateInterpolatedPlots(
    findDataPlot,
    deletedPlot.nodeUri,
  );
  findDataPlot = interpolatedDataPlot;

  // Update all error bands when we have combined coordinates
  const oldUrisToInterpolate = getUrisToInterpolate(
    findDataPlot.plot[0].nodeUri,
    [...findDataPlot.plot, deletedPlot],
  );
  const areCombinedCoordinates = oldUrisToInterpolate.length;
  if (areCombinedCoordinates) {
    // Update all error bands when we had combined coordinates before the deletion
    for (const plot of findDataPlot.plot) {
      await fetchErrorBands(findDataPlot, plot.nodeUri);
    }
  }

  const index = updatedActive.dataPlot.findIndex(
    (dp) => dp.i === interpolatedDataPlot.i,
  );
  updatedActive.dataPlot = [
    ...updatedActive.dataPlot.slice(0, index),
    interpolatedDataPlot,
    ...updatedActive.dataPlot.slice(index + 1),
  ];
  return updatedActive;
};

/**
 * Get error bands of the provided uri and update configuration
 * @param active
 * @param uri
 * @param editingGridId The grid being edited, from the UI slice. It used to be
 *   found by scanning `dataPlot` for the grid whose `isEditing` was set.
 */
export const fetchErrorBandsInConfig = async (
  active: Configuration,
  uri: string,
  editingGridId: string | null,
) => {
  const selectedDataPlot = active.dataPlot.find((d) => d.i === editingGridId);
  if (!selectedDataPlot) {
    // Don't get error bands when no editing dataPlot
    return;
  }

  if (!selectedDataPlot.displayErrorBand) {
    // Stop error bands when the dataPlot error_bands switch is off
    return;
  }

  try {
    const updatedPlot = selectedDataPlot.plot.find(
      (p) => normalizeIndices(p.nodeUri) === normalizeIndices(uri),
    );

    if (updatedPlot?.error_bands) {
      // Stop fetch of error bands when the dataPlot error_bands switch is on but already have error_bands (case occuring after saving customization in editing mode)
      return;
    }

    const updatedDataPlot = selectedDataPlot;
    const errBandsResponse = await fetchErrorBands(updatedDataPlot, uri);

    if (errBandsResponse) {
      const updatedCheckedNodeURI = active.checkedNodeURI;
      if (updatedPlot?.error_bands) {
        // Check error bands in tree
        for (const error_band of updatedPlot.error_bands) {
          const newCheckedNode = {
            name: updatedPlot.labelUri,
            uri: normalizeIndices(error_band.path),
            type: selectedDataPlot.dataType,
            is_geometry_node: selectedDataPlot.is_geometry_node,
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

function closeContourGeometrie(data: AxisData): AxisData {
  if (typeof data[0] === 'number') {
    const vector = data as number[];

    // Add first element in the end of the vector
    return [...vector, vector[0]] as AxisData;
  }

  // Go through last depth
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map(closeContourGeometrie) as AxisData;
}

const fetchGeometryOutline = async (
  uri: string,
  path: string,
  shouldSwitchAxis: boolean,
) => {
  const rPath = path + 'r';
  const zPath = path + 'z';

  // r and z are independent nodes: fetch them together rather than one after
  // the other, which doubled the wait for every geometry overlay.
  const [rResponse, zResponse] = await Promise.all([
    fetchDataPlot(normalizeIndices(uri + rPath)),
    fetchDataPlot(normalizeIndices(uri + zPath)),
  ]);

  // Get r
  rResponse.data.value = closeContourGeometrie(rResponse.data.value);
  const rFormattedCoordinates = formatCoordinates(
    rResponse.data.coordinates,
    0,
  );
  const rVector = getVectorData(rFormattedCoordinates, rResponse.data.value);

  // Get z
  zResponse.data.value = closeContourGeometrie(zResponse.data.value);
  const zFormattedCoordinates = formatCoordinates(
    zResponse.data.coordinates,
    0,
  );
  const zVector = getVectorData(zFormattedCoordinates, zResponse.data.value);

  let x, y: number[];

  if (shouldSwitchAxis) {
    x = zVector;
    y = rVector;
  } else {
    x = rVector;
    y = zVector;
  }

  // Get legend name
  const firstPart = path.slice(1).split('/')[0];
  const secondPart = path.slice(1).split('/unit')[0].split('/');
  const groupLegend = firstPart + '/' + secondPart[secondPart.length - 1];

  // Get outline
  const outlineGeometry: Geometry = {
    x: [...x],
    y: [...y],
    type: 'scatter',
    mode: 'lines',
    line: { color: 'black', width: 2 },
    geometry_node: uri + path,
    nodeUris: [uri + rPath, uri + zPath],
    name: groupLegend,
    legendgroup: groupLegend,
    showlegend: false,
  };
  return outlineGeometry;
};

const fetchGeometryRectangle = async (
  uri: string,
  path: string,
  shouldSwitchAxis: boolean,
) => {
  const rPath = path + 'r';
  const zPath = path + 'z';
  const widthPath = path + 'width';
  const heightPath = path + 'height';

  // The four nodes are independent: one round trip instead of four in a row.
  const [rResponse, zResponse, widthResponse, heightResponse] =
    await Promise.all([
      fetchDataPlot(normalizeIndices(uri + rPath)),
      fetchDataPlot(normalizeIndices(uri + zPath)),
      fetchDataPlot(normalizeIndices(uri + widthPath)),
      fetchDataPlot(normalizeIndices(uri + heightPath)),
    ]);
  const rVector = rResponse.data.value as number[][];
  const zVector = zResponse.data.value as number[][];
  const widthVector = widthResponse.data.value as number[][];
  const heightVector = heightResponse.data.value as number[][];

  const rectangleGeometry: Geometry[] = [];
  const lastCoord =
    zResponse.data.coordinates[zResponse.data.coordinates.length - 1];
  for (const [coordIndex] of lastCoord.value.entries()) {
    if (
      rVector[coordIndex][0] === -9e40 ||
      zVector[coordIndex][0] === -9e40 ||
      widthVector[coordIndex][0] === -9e40 ||
      heightVector[coordIndex][0] === -9e40
    ) {
      // Data equals to -9e+40 are unexpected
      continue;
    }

    // Format (x,y) points with rectangle rule
    let x, y: number[];
    x = [
      rVector[coordIndex][0] - widthVector[coordIndex][0] / 2,
      rVector[coordIndex][0] + widthVector[coordIndex][0] / 2,
      rVector[coordIndex][0] + widthVector[coordIndex][0] / 2,
      rVector[coordIndex][0] - widthVector[coordIndex][0] / 2,
    ];
    y = [
      zVector[coordIndex][0] - heightVector[coordIndex][0] / 2,
      zVector[coordIndex][0] - heightVector[coordIndex][0] / 2,
      zVector[coordIndex][0] + heightVector[coordIndex][0] / 2,
      zVector[coordIndex][0] + heightVector[coordIndex][0] / 2,
    ];

    // Close x & y vectors
    x.push(x[0]);
    y.push(y[0]);

    if (shouldSwitchAxis) {
      const tempX = x;
      x = y;
      y = tempX;
    }

    // Get legend name
    const groupLegend =
      path.slice(1).split('/')[0] + '/' + path.slice(1).split('/')[1];

    // Add a rectangle
    rectangleGeometry.push({
      x: [...x],
      y: [...y],
      type: 'scatter',
      mode: 'lines',
      line: { color: 'orange', width: 2 },
      geometry_node: uri + path,
      nodeUris: [uri + rPath, uri + zPath, uri + widthPath, uri + heightPath],
      name: groupLegend,
      legendgroup: groupLegend,
      showlegend: false,
      fill: 'toself',
    } as Geometry);
  }
  // Return rectangle list
  return rectangleGeometry;
};

const fetchGeometryOblique = async (
  uri: string,
  path: string,
  shouldSwitchAxis: boolean,
) => {
  const rPath = path + 'r';
  const zPath = path + 'z';
  const lengthAlphaPath = path + 'length_alpha';
  const lengthBetaPath = path + 'length_beta';
  const alphaPath = path + 'alpha';
  const betaPath = path + 'beta';

  // The six nodes are independent: one round trip instead of six in a row.
  const [
    rResponse,
    zResponse,
    lengthAlphaResponse,
    lengthBetaResponse,
    alphaResponse,
    betaResponse,
  ] = await Promise.all([
    fetchDataPlot(normalizeIndices(uri + rPath)),
    fetchDataPlot(normalizeIndices(uri + zPath)),
    fetchDataPlot(normalizeIndices(uri + lengthAlphaPath)),
    fetchDataPlot(normalizeIndices(uri + lengthBetaPath)),
    fetchDataPlot(normalizeIndices(uri + alphaPath)),
    fetchDataPlot(normalizeIndices(uri + betaPath)),
  ]);
  const rVector = rResponse.data.value as number[][];
  const zVector = zResponse.data.value as number[][];
  const lengthAlphaVector = lengthAlphaResponse.data.value as number[][];
  const lengthBetaVector = lengthBetaResponse.data.value as number[][];
  const alphaVector = alphaResponse.data.value as number[][];
  const betaVector = betaResponse.data.value as number[][];
  const obliqueGeometry: Geometry[] = [];
  const lastCoord =
    zResponse.data.coordinates[zResponse.data.coordinates.length - 1];
  for (const [coordIndex] of lastCoord.value.entries()) {
    if (
      rVector[coordIndex][0] === -9e40 ||
      zVector[coordIndex][0] === -9e40 ||
      lengthAlphaVector[coordIndex][0] === -9e40 ||
      lengthBetaVector[coordIndex][0] === -9e40 ||
      alphaVector[coordIndex][0] === -9e40 ||
      betaVector[coordIndex][0] === -9e40
    ) {
      // Data equals to -9e+40 are unexpected
      continue;
    }

    // Format (x,y) points with oblique rule
    let x, y: number[];

    const r = rVector[coordIndex][0];
    const z = zVector[coordIndex][0];

    const alphaLength = lengthAlphaVector[coordIndex][0];
    const betaLength = lengthBetaVector[coordIndex][0];

    const alpha = alphaVector[coordIndex][0];
    const beta = betaVector[coordIndex][0];

    // alpha: R axis reference
    const vxAlpha = alphaLength * Math.cos(alpha);
    const vyAlpha = alphaLength * Math.sin(alpha);

    // beta: Z axis reference
    const vxBeta = -betaLength * Math.sin(beta);
    const vyBeta = betaLength * Math.cos(beta);

    const p0 = { x: r, y: z };

    const p1 = {
      x: r + vxAlpha,
      y: z + vyAlpha,
    };

    const p2 = {
      x: r + vxBeta,
      y: z + vyBeta,
    };

    const p3 = {
      x: p1.x + vxBeta,
      y: p1.y + vyBeta,
    };

    x = [p0.x, p1.x, p3.x, p2.x, p0.x];

    y = [p0.y, p1.y, p3.y, p2.y, p0.y];

    // Close x & y vectors
    x.push(x[0]);
    y.push(y[0]);

    if (shouldSwitchAxis) {
      const tempX = x;
      x = y;
      y = tempX;
    }

    // Get legend name
    const groupLegend =
      path.slice(1).split('/')[0] + '/' + path.slice(1).split('/')[1];

    // Add a oblique
    obliqueGeometry.push({
      x: [...x],
      y: [...y],
      type: 'scatter',
      mode: 'lines',
      line: { color: 'orange', width: 2 },
      geometry_node: uri + path,
      nodeUris: [
        uri + rPath,
        uri + zPath,
        uri + lengthAlphaPath,
        uri + lengthBetaPath,
        uri + alphaPath,
        uri + betaPath,
      ],
      name: groupLegend,
      legendgroup: groupLegend,
      showlegend: false,
      fill: 'toself',
    } as Geometry);
  }
  // Return oblique list
  return obliqueGeometry;
};

export const fetchGeometries = async (
  wantedGeometryPath: string,
  dataPlot: DataGridPlot,
  updatedCheckedNodeURI?: URITreeNodeData[],
  geometryInfos?: GeometryInfos,
  dataURI?: URIData[],
) => {
  try {
    // Replace uri name by real uri if needed
    if (wantedGeometryPath.split('#')[0].includes('URI-')) {
      const uriName = wantedGeometryPath.split('#')[0];
      const realUri = dataURI.find((uri) => uri.name === uriName)?.uri;
      if (realUri) {
        wantedGeometryPath = realUri + '#' + wantedGeometryPath.split('#')[1];
      }
    }

    const uri = wantedGeometryPath.split('#')[0];
    const path = '#' + wantedGeometryPath.split('#')[1];

    const shouldSwitchAxis =
      dataPlot.coordinates.findIndex((coord) => coord.axeIndex === 0) === 1;

    const pathSplitted = wantedGeometryPath.split('/');
    const typeOfGeometry = pathSplitted[pathSplitted.length - 2];

    if (typeOfGeometry === 'outline') {
      // Get outline
      const contourGeometry = await fetchGeometryOutline(
        uri,
        path,
        shouldSwitchAxis,
      );
      dataPlot.geometries.push(contourGeometry);
    } else if (typeOfGeometry === 'geometry') {
      const types = Array.from(
        new Set([
          ...geometryInfos.parameters.map((param) => param.split('/')[0]),
        ]),
      );

      for (const type of types) {
        if (type === 'rectangle') {
          // Get rectangle
          const rectangleGeometry = await fetchGeometryRectangle(
            uri,
            path + type + '/',
            shouldSwitchAxis,
          );
          dataPlot.geometries = [...dataPlot.geometries, ...rectangleGeometry];
        } else if (type === 'oblique') {
          // Get oblique
          const obliqueGeometry = await fetchGeometryOblique(
            uri,
            path + type + '/',
            shouldSwitchAxis,
          );
          dataPlot.geometries = [...dataPlot.geometries, ...obliqueGeometry];
        }
      }
    } else {
      showNotification({
        title: `Unable to plot ${typeOfGeometry} geometry`,
        message: `${typeOfGeometry} geometries are not implemented yet`,
        color: 'yellow',
      });
      return;
    }

    if (dataPlot?.geometries) {
      const displayedLegendGroups: string[] = [];
      // Show each group in legend
      for (const geometry of dataPlot.geometries) {
        if (!displayedLegendGroups.find((lg) => lg === geometry.legendgroup)) {
          displayedLegendGroups.push(geometry.legendgroup);
          geometry.showlegend = true;
        }
      }
    }

    if (dataPlot?.geometries && updatedCheckedNodeURI) {
      // Check geometries in tree
      for (const geometry of dataPlot.geometries) {
        for (const uriOfGeo of geometry.nodeUris) {
          const newCheckedNode = {
            name: dataPlot.plot[0].labelUri,
            uri: normalizeIndices(uriOfGeo),
            type: NodeInfoTypeEnum.FLOAT,
            is_geometry_node: true,
          } as URITreeNodeData;
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
    }

    // Return dataPlot list with all geometries
    return dataPlot;
  } catch (error) {
    console.error('Error getting geometries:', error);
    showNotification({
      title: 'Geometry',
      message: 'Failed to get geometry',
      color: 'red',
    });
  }
};

/**
 * Tells a node that carries no error bands from a genuine failure.
 *
 * Both are expected while plotting: the backend answers 464 "No data for ..."
 * for an error node that exists but is empty, and 404 "... has no attribute
 * ..." for one the IDS does not define at all.
 */
const isMissingErrorNode = (error: unknown): boolean => {
  const message = String(error);
  return (
    (message.includes('No data for') || message.includes('has no attribute')) &&
    (message.includes('_error_upper') || message.includes('_error_lower'))
  );
};

/**
 * Get & return error bands of provided uri & dataPlot id
 * @param dataPlot Datagrid containing the targeted uri
 * @param uri Uri to get the data
 * @param forcedDownsamplingMethod Forced downsample method (optional)
 * @param forcedDownsamplingSize Forced downsample size (optional)
 * @param forcedInterpolationMethod Forced interpolation method (optional)
 * @returns
 */
export const fetchErrorBands = async (
  dataPlot: DataGridPlot,
  uri: string,
  forcedDownsamplingMethod?: string,
  forcedDownsamplingSize?: number,
  forcedInterpolationMethod?: string,
) => {
  if (!dataPlot.displayErrorBand) {
    // Stop error bands when the dataPlot switch is off
    return;
  }

  const plot = dataPlot.plot.find(
    (p) => normalizeIndices(p.nodeUri) === normalizeIndices(uri),
  );
  if (!plot) {
    return;
  }

  try {
    const downsamplingMethod: string =
      forcedDownsamplingMethod || dataPlot?.downsampled_method;
    const downsamplingSize: number =
      forcedDownsamplingSize || dataPlot?.downsampled_size;
    const urisToInterpolate = getUrisToInterpolate(plot.nodeUri, dataPlot.plot);
    const interpolationMethod: string =
      forcedInterpolationMethod || dataPlot?.interpolated_method;

    /**
     * Fetches one of the two band nodes, or resolves to `undefined` when that
     * node simply is not there.
     *
     * The upper and lower bands are two independent nodes, and a quantity may
     * carry only one of them: the IMAS convention is that a *symmetric* error
     * is stored as `_error_upper` alone. Fetching them together used to mean
     * that one missing node threw away the one that was present, leaving the
     * trace with no band at all - `getErrorsAreaToPlot` has always known how to
     * mirror a single band around the trace, it was never given one.
     */
    const fetchErrorBand = async (
      suffix: '_error_upper' | '_error_lower',
    ): Promise<FieldValueResponse | undefined> => {
      const bandUri = normalizeIndices(plot.nodeUri) + suffix;
      try {
        if (urisToInterpolate.length) {
          const interpolated = await fetchDataPlot(
            bandUri,
            downsamplingMethod,
            downsamplingSize,
            dataPlot?.dataType,
            urisToInterpolate,
            interpolationMethod,
          );
          return {
            value: interpolated.data.value,
            valueRef: interpolated.data.valueRef,
          } as FieldValueResponse;
        }
        return await fetchFieldValue(
          bandUri,
          downsamplingMethod,
          downsamplingSize,
          dataPlot?.dataType,
        );
      } catch (error) {
        if (isMissingErrorNode(error)) {
          return undefined;
        }
        throw error;
      }
    };

    const [upperResponse, lowerResponse] = await Promise.all([
      fetchErrorBand('_error_upper'),
      fetchErrorBand('_error_lower'),
    ]);

    if (!upperResponse && !lowerResponse) {
      // Neither node exists: the expected case for most quantities.
      console.warn('No error bands for : ', plot.nodeUri);
      return;
    }

    // Push order is the contract `formatErrorBandLayout` reads: the upper band
    // is index 0, the lower one index 1. With a single band, whichever it is,
    // that band is used on both sides of the trace.
    if (upperResponse) {
      formatErrorBands(
        plot,
        getVectorData(dataPlot.coordinates, upperResponse.value),
        upperResponse.value,
        plot.nodeUri + '_error_upper',
        upperResponse.valueRef,
      );
    }

    if (lowerResponse) {
      formatErrorBands(
        plot,
        getVectorData(dataPlot.coordinates, lowerResponse.value),
        lowerResponse.value,
        plot.nodeUri + '_error_lower',
        lowerResponse.valueRef,
      );
    }

    // Return dataPlot list with the plot which includes error bands
    return dataPlot;
  } catch (error) {
    // Only unexpected failures reach here: a missing band node is handled by
    // `fetchErrorBand` above.
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
  yDataRef?: string,
) => {
  if (!(nodeUri.endsWith('_error_lower') || nodeUri.endsWith('_error_upper'))) {
    return;
  }

  if (foundedPlot && !foundedPlot?.error_bands) {
    // Init error_bands
    foundedPlot.error_bands = [];
  }

  foundedPlot.error_bands = foundedPlot.error_bands.filter(
    (errors) => errors.path !== normalizeIndices(nodeUri),
  );
  // Update error_bands by adding the new selected one
  foundedPlot.error_bands.push({
    path: normalizeIndices(nodeUri),
    yData: yData,
    yDataRef: yDataRef,
  });
};

const formatErrorBandLayout = (
  error_band_type: 'upper' | 'lower',
  mainPlot: DataPlotly,
  x: (string | number)[],
  mainY: number[],
  bands: Datum[][],
  plotIndex: number,
  symmetricalCase?: boolean,
) => {
  const lineShape = (mainPlot.line?.shape ?? 'linear') as 'linear' | 'hv';

  const errBandTypePosition = symmetricalCase
    ? 0
    : error_band_type === 'lower'
      ? 1
      : 0;
  const yDiff = (bands[errBandTypePosition] ?? []) as number[];
  const length = Math.min(mainY.length, yDiff.length);
  const yErrBandPart = new Array<number>(length);
  for (let i = 0; i < length; i++) {
    if (error_band_type === 'lower') {
      yErrBandPart[i] = mainY[i] - yDiff[i];
    } else {
      yErrBandPart[i] = mainY[i] + yDiff[i];
    }
  }
  const errBandPartPlot: Partial<ScatterData> = {
    x: [...x],
    y: [...yErrBandPart],
    type: 'scatter',
    mode: 'lines',
    line: { width: 0, shape: lineShape },
    hoverinfo: 'skip',
    // A band belongs on its trace's axis. Without this it lands on y1 - Plotly's
    // default - and a band around a y2 trace drags y1's autorange onto y2's
    // scale, flattening everything actually plotted on y1.
    yaxis: mainPlot.yaxis,
  };
  if (error_band_type === 'lower') {
    errBandPartPlot.showlegend = false;
  } else {
    errBandPartPlot.name = 'error bands';
    errBandPartPlot.fill = 'tonexty';
    errBandPartPlot.fillcolor = mainPlot.line?.color
      ? rgbToRgba(mainPlot.line?.color, 0.2)
      : rgbToRgba(defaultColorsRGB[plotIndex], 0.2);
  }
  return errBandPartPlot;
};

/**
 * Everything Plotly is handed for one grid, built from the payloads and the
 * cursor.
 *
 * The traces are new objects every time, and the store's are never among them:
 * Plotly keeps and mutates what it is given. That used to be arranged by
 * copying each stored trace here and letting this function write back onto the
 * copy; the vectors are now derived rather than copied, so there is nothing to
 * copy from.
 */
export function buildTraces(
  plots: DataPlotly[],
  coordinates: Coordinates[],
): (Partial<ScatterData> | DataPlotly)[] {
  const entirePlotList: (Partial<ScatterData> | DataPlotly)[] = [];
  const x = axisVector(coordinates, 0) ?? [];

  for (const [plotIndex, storedPlot] of plots.entries()) {
    const y = (lineVector(storedPlot.yData, coordinates) ?? []) as number[];
    const bands = bandVectors(storedPlot, coordinates);

    const mainPlot = {
      ...storedPlot,
      x: [...x],
      y: [...y],
      // Each plot should have connectgaps equals to true to prevent gap in combined data cases
      connectgaps: true,
    } as DataPlotly;
    entirePlotList.push(mainPlot);

    if (storedPlot?.error_bands && storedPlot.error_bands.length === 2) {
      // Add lower and upper
      const lowerPlot = formatErrorBandLayout(
        'lower',
        mainPlot,
        x,
        y,
        bands,
        plotIndex,
      );
      lowerPlot.connectgaps = true;
      entirePlotList.push(lowerPlot);
      const upperPlot = formatErrorBandLayout(
        'upper',
        mainPlot,
        x,
        y,
        bands,
        plotIndex,
      );
      upperPlot.connectgaps = true;
      entirePlotList.push(upperPlot);
    } else if (storedPlot?.error_bands && storedPlot.error_bands.length === 1) {
      // Symmetrical case: use upper for the interval
      const lowerPlot = formatErrorBandLayout(
        'lower',
        mainPlot,
        x,
        y,
        bands,
        plotIndex,
        true,
      );
      lowerPlot.connectgaps = true;
      entirePlotList.push(lowerPlot);
      const upperPlot = formatErrorBandLayout(
        'upper',
        mainPlot,
        x,
        y,
        bands,
        plotIndex,
        true,
      );
      upperPlot.connectgaps = true;
      entirePlotList.push(upperPlot);
    }

    if (storedPlot?.error_bands?.length) {
      mainPlot.customdata = customdataOf(bands);
      mainPlot.hovertemplate =
        'x: %{x}<br>y: %{y}<br>' +
        (storedPlot.error_bands.length === 2
          ? 'upper y: +%{customdata[0]}<br>lower y: -%{customdata[1]}<br>'
          : 'y error bands: \u00b1%{customdata[0]}<br>') +
        '<extra></extra>';
    }
  }
  return entirePlotList;
}

/**
 * The part of a Plotly layout that only the user can produce: what they did
 * with the mode bar (zoom, pan, autoscale, drag mode).
 */
export interface UserRelayout {
  /** Per axis id (`xaxis`, `yaxis`, `yaxis2`), merged into the derived axis. */
  axes: Record<string, Partial<LayoutAxis>>;
  /** Everything else Plotly reported, merged at the top level of the layout. */
  layout: Partial<Layout>;
}

/** Nothing changed yet. A shared constant so a reset is a no-op re-render. */
export const emptyUserRelayout: UserRelayout = { axes: {}, layout: {} };

const AXIS_RELAYOUT_KEY = /^([xyz]axis\d*)\.(range(?:\[([01])\])?|autorange)$/;

/**
 * Folds one `plotly_relayout` payload into the view state kept across layout
 * rebuilds.
 *
 * Plotly reports what the user did as dotted keys (`yaxis.range[0]`,
 * `yaxis.autorange`). Merging those blindly - which is what the layout memos
 * used to do - kept every key forever: the ranges of an old zoom outlived the
 * autoscale that was supposed to clear them. They are parsed per axis here
 * instead, so that `range` and `autorange`, which contradict each other,
 * replace one another.
 */
export const mergeAxisRelayout = (
  previous: UserRelayout,
  payload: Partial<Layout>,
): UserRelayout => {
  const axes: UserRelayout['axes'] = { ...previous.axes };
  const layout = { ...previous.layout } as Record<string, unknown>;

  for (const [key, value] of Object.entries(payload ?? {})) {
    const match = AXIS_RELAYOUT_KEY.exec(key);
    if (!match) {
      layout[key] = value;
      continue;
    }

    const [, axisName, attribute, bound] = match;
    const axis: Partial<LayoutAxis> = { ...axes[axisName] };

    if (attribute === 'autorange') {
      axis.autorange = value as LayoutAxis['autorange'];
      // Autoscaling drops the zoom it replaces; `autorange: false` only ever
      // accompanies a range, so it must not.
      if (value) delete axis.range;
    } else {
      delete axis.autorange;
      if (bound === undefined) {
        axis.range = value as LayoutAxis['range'];
      } else {
        const range = [...(axis.range ?? [])];
        range[Number(bound)] = value;
        axis.range = range;
      }
    }

    axes[axisName] = axis;
  }

  return { axes, layout: layout as Partial<Layout> };
};

/**
 * Init plots color by adding color in plot.line for each plot
 */
export const initPlotColors = async (
  customizedDataGrid: DataGridPlot,
  customContainerRef: React.MutableRefObject<HTMLDivElement>,
  setterForCustomization?: React.Dispatch<React.SetStateAction<DataGridPlot>>,
) => {
  // Get plot colors when select 1D plots accordion
  const customContainer = customContainerRef.current;
  if (!customContainer) return;
  // Get child elements from the legend
  const legends = Array.from(
    customContainer.querySelectorAll<SVGGElement>('g.layers'),
  ).filter((g) => {
    return g.previousSibling.textContent?.trim() !== 'error bands';
  });

  const updatedPlotColors = setterForCustomization
    ? cloneGridStructure(customizedDataGrid)
    : customizedDataGrid;

  if (
    updatedPlotColors.plot.length &&
    legends.length === updatedPlotColors.plot.length
  ) {
    // When we have a color legend (so several plots)
    let plotIndex = 0;
    let shouldUpdateColors = false;
    for (const plot of updatedPlotColors.plot) {
      // Get from DOM & set color in plot.line for each plots
      if (!plot?.line?.color) {
        shouldUpdateColors = true;
      }

      const line = legends[plotIndex].querySelector<SVGGElement>(
        'g.legendlines > path',
      );
      // We get color from point when plot.mode === "markers"
      const point = legends[plotIndex].querySelector<SVGGElement>(
        'g.legendpoints > path',
      );
      const colorFromDOM = line?.style?.stroke || point?.style?.fill;

      // A new object rather than a write into `plot.line`, which the copy
      // above shares with the grid it came from.
      plot.line = { ...plot.line, color: colorFromDOM } as PlotLine;
      plotIndex++;
    }
    if (!shouldUpdateColors) {
      return;
    }
  } else if (updatedPlotColors.plot.length) {
    // When we have only one plot, there is no legend so we set manualy to his default plotly color
    for (const [index, plot] of updatedPlotColors.plot.entries()) {
      if (!plot?.line?.color) {
        plot.line = { ...plot.line, color: defaultColorsRGB[index] };
      }
    }
  }
  if (setterForCustomization) {
    setterForCustomization(updatedPlotColors);
  } else {
    return updatedPlotColors;
  }
};

/**
 * @description Convert the operand URIs of the signal operations to the
 * "<labelUri>#<path>" form used in saved configurations, mirroring the
 * transformation applied to plot.nodeUri when saving.
 * @param operations The operations of the plot being saved
 * @param plots The plots of the grid, used to resolve the operand labelUri
 */
export const formatSignalOperandsToSave = (
  operations: DataOperation[] | undefined,
  plots: BaseDataPlotly[],
): DataOperation[] | undefined =>
  operations?.map((operation) => {
    if (!isSignalOperation(operation) || !operation.value) return operation;
    const operand = plots.find(
      (plot) =>
        normalizeIndices(plot.nodeUri) === normalizeIndices(operation.value),
    );
    // Keep the URI untouched when the operand plot is no longer in the grid
    const separatorIndex = operation.value.indexOf('#');
    if (!operand || separatorIndex === -1) return operation;
    return {
      ...operation,
      value: `${operand.labelUri}${operation.value.slice(separatorIndex)}`,
    };
  });

/**
 * @description Restore the absolute operand URIs of the signal operations from
 * the "<labelUri>#<path>" form stored in a saved configuration.
 * @param operations The operations read from the saved configuration
 * @param dataURI The data entries of the configuration being loaded
 */
export const formatSignalOperandsToLoad = (
  operations: DataOperation[] | undefined,
  dataURI: URIData[],
): DataOperation[] | undefined =>
  operations?.map((operation) => {
    if (!isSignalOperation(operation) || !operation.value) return operation;
    const separatorIndex = operation.value.indexOf('#');
    if (separatorIndex === -1) return operation;
    const label = operation.value.slice(0, separatorIndex);
    const uriToApply = dataURI.find((uri) => uri.name === label)?.uri;
    // Only remap when the prefix is a known data entry name, otherwise the
    // operand URI is already absolute
    return uriToApply
      ? {
          ...operation,
          value: `${uriToApply}${operation.value.slice(separatorIndex)}`,
        }
      : operation;
  });

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
      dataType: data.dataType,
      coordinates:
        data.coordinates && data.coordinates.length > 0
          ? data.coordinates.map((coord: BaseCoordinates): Coordinates => {
              return {
                ...coord,
                name: '',
                shape: [],
                coord_dependencies: [],
                data: [],
              };
            })
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
          operations: formatSignalOperandsToLoad(
            plot.operations,
            activeConfiguration.dataURI,
          ),
          yData: [],
          unit: '',
        } as DataPlotly;
      }),
      geometries: (data?.geometries as Geometry[]) || [],
      synchronizedGrids: data?.synchronizedGrids
        ? data.synchronizedGrids
        : { color: '', list: [] },
    }),
  );

  return newListDataGridPlot;
}

/**
 * Returns the coordinates from BE in expected format
 * @param receivedCoords
 * @param defaultUri
 * @returns Formatted coordinates
 */
function formatCoordinates(
  receivedCoords: PlotCoordinatesResponse[],
  valueIndex: number,
) {
  const formattedCoordinates: Coordinates[] = receivedCoords.map(
    (coordinate: PlotCoordinatesResponse, index) => {
      const lastField = getLastIndexedField(coordinate.target);
      return {
        name: coordinate.name,
        shape: coordinate.shape,
        downsampled_shape: coordinate.downsampled_shape,
        coord_dependencies: coordinate.coordinates,
        data: coordinate.value,
        dataRef: coordinate.valueRef,
        valueIndex: valueIndex,
        path:
          valueIndex === 0
            ? getDefaultUri(coordinate.path)
            : updateIndexFieldName(coordinate.path, lastField, valueIndex),
        target:
          valueIndex === 0
            ? getDefaultUri(coordinate.target)
            : updateIndexFieldName(coordinate.target, lastField, valueIndex),
        axeIndex: index,
        unit: coordinate.unit || '',
      };
    },
  );

  return formattedCoordinates;
}

/**
 * @description Fetches data for each plot in the provided DataGridPlot from file configuration.
 * @param dataGridPlot The array of DataGridPlot objects to fetch data for.
 * @returns A promise that resolves to an array of updated DataGridPlot objects.
 */
export async function plotNodeUriLoaded(
  dataGridPlot: DataGridPlot[],
  dataURI: URIData[],
): Promise<DataGridPlot[]> {
  try {
    let errorHasOccurred = false;

    const updatedDataGridPlot: DataGridPlot[] = await Promise.all(
      dataGridPlot.map(async (dataGrid): Promise<DataGridPlot> => {
        for (const [index, coord] of dataGrid.coordinates.entries()) {
          coord.axeIndex = index;
        }
        const updatedXAxisData: Axis = dataGrid.xAxisData;

        const updatedPlot: DataPlotly[] = [];
        for (const plot of dataGrid.plot) {
          if (!plot.nodeUri) {
            updatedPlot.push(plot);
            continue;
          }

          try {
            const defaultUri = normalizeIndices(plot.nodeUri); // Normalize the URI to ensure it matches the expected format
            const urisToInterpolate = getUrisToInterpolate(
              plot.nodeUri,
              dataGrid.plot,
            );

            const response = await fetchDataPlot(
              defaultUri,
              dataGrid?.downsampled_method,
              dataGrid?.downsampled_size,
              dataGrid?.dataType,
              urisToInterpolate,
              dataGrid?.interpolated_method,
              buildSmoothingRequest(plot.smoothing),
              formatOperations(plot.operations),
              formatSignalOperations(plot.operations),
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
            for (const [
              index,
              responseCoordinates,
            ] of response.data.coordinates.entries()) {
              const found = dataGrid.coordinates.find(
                (c: Coordinates) =>
                  normalizeIndices(c.path) === responseCoordinates.path,
              );
              // Every field of it is reassigned below; the payload is replaced.
              const matchingCoord: Coordinates = found && { ...found };
              const lastField = getLastIndexedField(responseCoordinates.target);
              if (!lastField) continue;

              // If coordinates exist, update it with response from BE
              matchingCoord.axeIndex = index;
              matchingCoord.data = responseCoordinates.value;
              matchingCoord.dataRef = responseCoordinates.valueRef;
              matchingCoord.name = responseCoordinates.name;
              matchingCoord.path = getDefaultUri(responseCoordinates.path);
              matchingCoord.unit = responseCoordinates.unit || '';
              matchingCoord.shape = responseCoordinates.downsampled_shape;
              matchingCoord.coord_dependencies =
                responseCoordinates.coordinates;

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

            if (response.data.interpolated_method) {
              dataGrid.interpolated_method = response.data.interpolated_method;
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
              yDataRef: response.data.valueRef,
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

        // Rule to define the default plot mode
        dataGrid.selectedPlotMode =
          dataGrid.coordinates.length >= 2 &&
          containsFloat(dataGrid.coordinates[1]?.data)
            ? 'Heatmap'
            : '1D';

        const dataGridUpdated = {
          ...dataGrid,
          forceXyRatio: dataGrid?.forceXyRatio ?? false,
          xAxisData: updatedXAxisData,
          plot: updatedPlot,
        } as DataGridPlot;

        // Transpose dataGrid at launch
        if (
          JSON.stringify(
            dataGrid.coordinates.map((coord) => coord.axeIndex),
          ) !==
          JSON.stringify(dataGrid.coordinates.map((coord, index) => index))
        ) {
          const customizedDataGrid = dataGrid;
          const updatedDataPlot = cloneGridStructure(dataGridUpdated);
          for (const [index, coord] of updatedDataPlot.coordinates.entries()) {
            // Set to original axe indexes in order apply the transposition
            coord.axeIndex = index;
          }

          // Apply swap axis if different from default
          const wantedAxeIndexOrder = customizedDataGrid.coordinates.map(
            (coord) => coord.axeIndex,
          );

          const transposedDataPlot = await transposeDataGrid(
            updatedDataPlot,
            wantedAxeIndexOrder,
            true,
          );
          dataGridUpdated.coordinates = transposedDataPlot.coordinates;
          dataGridUpdated.plot = transposedDataPlot.plot;
        }

        // Retrieve saved geometries
        if (dataGridUpdated.geometries.length) {
          const listOfGeometries: GeometryInfos[] =
            dataGridUpdated.geometries.map((geo) => ({
              geometry_node: geo.geometry_node,
              parameters: geo.nodeUris,
            }));
          dataGridUpdated.geometries = [];
          for (const geometry of listOfGeometries) {
            const geometryToDisplay = listOfGeometries.find(
              (g) => g.geometry_node === geometry.geometry_node,
            );
            await fetchGeometries(
              geometry.geometry_node,
              dataGridUpdated,
              undefined,
              geometryToDisplay,
              dataURI,
            );
          }
        }

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

        // Cut the freshly fetched arrays to the ranges the saved configuration
        // carries. The sliders keep the positions the configuration saved.
        if (dataPlot.coordinates?.some((coordinate) => coordinate.range)) {
          const windowed = await applyRangesToGrid(dataPlot);
          updatedDataGridPlot[updatedDataGridPlot.indexOf(dataPlot)] = windowed;
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
 * Transpose dataGrid
 * @param updatedDataGrid
 * @param wantedAxeIndexOrder
 * @param keepValueIndex
 * @returns the transposed dataGrid
 */
export const transposeDataGrid = async (
  updatedDataGrid: DataGridPlot,
  wantedAxeIndexOrder: number[],
  keepValueIndex?: boolean,
) => {
  let actualAxeIndexOrder = updatedDataGrid.coordinates.map(
    (coord) => coord.axeIndex,
  );
  let transposedDataGrid = cloneGridStructure(updatedDataGrid);
  if (
    JSON.stringify(wantedAxeIndexOrder) !== JSON.stringify(actualAxeIndexOrder)
  ) {
    // Get transposed order
    let index = 0;
    for (const wantedAxeIndex of wantedAxeIndexOrder) {
      if (wantedAxeIndex !== actualAxeIndexOrder[index]) {
        const newTransposedDataGrid = await swapAxis(
          transposedDataGrid,
          wantedAxeIndex,
          actualAxeIndexOrder[index],
          keepValueIndex,
        );
        actualAxeIndexOrder = newTransposedDataGrid.coordinates.map(
          (coord) => coord.axeIndex,
        );
        transposedDataGrid = newTransposedDataGrid;
      }
      index++;
    }
  }
  return transposedDataGrid;
};

/**
 * Re-apply the axis transposition after a back-end fetch (data comes back in
 * default axeIndex order). Pass a targetPlot to only transpose that plot
 * (single-plot fetch), otherwise the whole grid is transposed.
 * @param updatedDataPlot
 * @param wantedAxeIndexOrder
 * @param targetPlot
 */
export const reapplyAxisOrder = async (
  updatedDataPlot: DataGridPlot,
  wantedAxeIndexOrder: number[],
  targetPlot?: DataPlotly,
) => {
  const isTransposed =
    JSON.stringify(wantedAxeIndexOrder) !==
    JSON.stringify(updatedDataPlot.coordinates.map((_, index) => index));
  if (!isTransposed) {
    return;
  }

  if (targetPlot) {
    // Transpose only the target plot through a temporary grid with default axeIndex
    const tempGrid = cloneGridStructure(updatedDataPlot);
    tempGrid.plot = tempGrid.plot.filter((p) => p.name === targetPlot.name);
    tempGrid.coordinates.forEach((coord, index) => {
      coord.axeIndex = index;
    });
    const transposed = await transposeDataGrid(
      tempGrid,
      wantedAxeIndexOrder,
      true,
    );
    // Copy transposed data back on the real plot
    const transposedPlot = transposed.plot[0];
    targetPlot.yData = transposedPlot.yData;
    targetPlot.yDataRef = transposedPlot.yDataRef;
    targetPlot.shape = transposedPlot.shape;
    return;
  }

  // Reset axeIndex to default order then transpose the whole grid
  updatedDataPlot.coordinates.forEach((coord, index) => {
    coord.axeIndex = index;
  });
  const transposed = await transposeDataGrid(
    updatedDataPlot,
    wantedAxeIndexOrder,
    true,
  );
  updatedDataPlot.coordinates = transposed.coordinates;
  updatedDataPlot.plot = transposed.plot;
};

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

  const lastDim = getLastDimLength(value);

  // Check if matrix is not empty & get at least one valide value
  return lastDim !== null && lastDim !== 0 && hasAtLeastOneValidValue(value);
}

/**
 * @description Length of the innermost dimension of a rectangular nested array,
 * or `null` when the input is ragged, mixed-depth or holds non-plottable
 * leaves (complex `{r, i}` pairs, objects).
 *
 * This replaces a `tf.tensor(value)` whose only outputs were "does it build"
 * and "what is the last dimension". Building a tensor copied the whole array
 * into a typed array on every call — and it was called from the render body of
 * both plot components, several times per render, without ever being disposed.
 * A plain scan allocates nothing and keeps exactly the same semantics,
 * including returning `null` where `tf.tensor` used to throw.
 */
function getLastDimLength(value: AxisData): number | null {
  if (!Array.isArray(value)) return null;
  if (value.length === 0) return 0;

  const first = value[0];
  if (!Array.isArray(first)) {
    // Innermost level. tf.tensor accepted only numbers or only strings, and
    // threw on anything else (including complex {r, i} pairs) or on a mix of
    // the two, so reproduce both rules.
    let leafType: 'number' | 'string' | null = null;
    for (const leaf of value as unknown[]) {
      if (Array.isArray(leaf)) return null; // mixed depth
      if (leaf === null || leaf === undefined) continue; // filled in later
      const type = typeof leaf;
      if (type !== 'number' && type !== 'string') return null;
      if (leafType === null) leafType = type;
      else if (leafType !== type) return null; // mixed scalar types
    }
    return value.length;
  }

  // Nested level: every child must be an array of the same, consistent shape.
  let lastDim: number | null = null;
  for (const child of value as AxisData[]) {
    if (!Array.isArray(child)) return null; // mixed depth
    if (child.length !== (first as unknown[]).length) return null; // ragged
    const childLastDim = getLastDimLength(child);
    if (childLastDim === null) return null;
    if (lastDim === null) lastDim = childLastDim;
    else if (lastDim !== childLastDim) return null;
  }
  return lastDim;
}

/**
 * Transpose all plots from a dataGrid and update paths with related value indexes
 * @param itemDataGrid
 * @param axeIndexToSwap
 * @param axeIndexOfTargetAxis
 * @param keepValueIndex
 * @param active
 * @param updatedConfiguration
 * @returns The transposed dataGrid
 */
export const swapAxis = async (
  itemDataGrid: DataGridPlot,
  axeIndexToSwap: number,
  axeIndexOfTargetAxis: number,
  keepValueIndex?: boolean,
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

  // Structural copies, not deep ones. A transposition replaces payload arrays,
  // it never writes into them, so the swapped grid can share them with the one
  // it replaces - and the grids this swap does not touch keep their identity,
  // so the panels showing them do not re-render.
  const usesStore = Boolean(active && updatedConfiguration);
  const updatedDataPlot = cloneGridStructure(
    usesStore
      ? active.dataPlot.find(
          (dataPlotToUpdate) => dataPlotToUpdate.i === itemDataGrid.i,
        )
      : itemDataGrid,
  );
  const updatedDataPlotList: DataGridPlot[] = usesStore
    ? active.dataPlot.map((dataPlotToUpdate) =>
        dataPlotToUpdate.i === itemDataGrid.i
          ? updatedDataPlot
          : dataPlotToUpdate,
      )
    : null;

  // Swap axis
  updatedDataPlot.coordinates[actualTargetAxisIndex].axeIndex = axeIndexToSwap;
  updatedDataPlot.coordinates[itemToSwitchIndex].axeIndex =
    axeIndexOfTargetAxis;

  // Reset indexValue
  if (!keepValueIndex) {
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

  // Limit coordinate sliders to the max of their new shape
  clampCursors(updatedDataPlot.coordinates);

  if (updatedDataPlot.geometries) {
    // Swap geometries x & y in the case we swap x & y coordinates
    for (const geo of updatedDataPlot.geometries) {
      const tempX = geo.x;
      geo.x = geo.y;
      geo.y = tempX;
    }
  }

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
 * Pull every cursor back inside its axis.
 *
 * A cursor is an index, so narrowing a range or transposing can leave one
 * pointing past the end of the axis it indexes. Nothing derives a row from an
 * out-of-range cursor, so it has to be corrected on the document rather than
 * worked around at the point of use.
 */
export function clampCursors(coordinates: Coordinates[]) {
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
 * Convert all last children of shape [number, number] into {r, i} objects.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function transformComplexData(arr: any[]): any[] {
  const maxDepth = getMaxShape(arr).length;

  function transform(node: any, depth: number): any {
    if (!Array.isArray(node)) return node;

    if (depth === maxDepth - 1) {
      // Format children having complex type
      node = node[0] + node[1]; // TODO => update this transformation to ITER needs when we will received it (complex type : {r: node[0], i: node[1]})
      return node;
    }

    return node.map((child) => transform(child, depth + 1));
  }

  return transform(arr, 0);
}

async function transposeMatrix(yData: AxisData, newPositions: number[]) {
  // Transpose dataY
  const tensor = await getTensorizedMatrix(yData);
  const dataTransposed = tensor.transpose(newPositions);
  return dataTransposed;
}

/**
 * The axis permutation that swapping two display axes applies to the payload.
 *
 * It depends only on the coordinates, and a transposition does not touch those,
 * so it is computed once for the grid rather than once per trace.
 */
const transposePermutation = (
  coordinates: Coordinates[],
  axeIndexToSwap: number,
  axeIndexOfTargetAxis: number,
): number[] => {
  // Initial position, reversed to get axeIndex order
  const newPositions = coordinates
    .map((coord) => coord.axeIndex)
    .sort((a, b) => a - b)
    .reverse();
  // SWAP axeIndexOfTargetAxis with axeIndexToSwap
  const tempSwap = newPositions[axeIndexOfTargetAxis];
  newPositions[axeIndexOfTargetAxis] = newPositions[axeIndexToSwap];
  newPositions[axeIndexToSwap] = tempSwap;
  // Reverse for getting position => [0, 1, 3, 2]
  newPositions.reverse();
  return newPositions;
};

/** Permutes a shape the way `newPositions` permutes the data it describes. */
const permuteShape = (shape: number[], newPositions: number[]): number[] =>
  newPositions.map((axis) => shape[axis]);

/**
 * Transposes one payload, through the registry.
 *
 * The result is a payload in its own right, named by composing the permutation
 * onto the source key, so an axis order reached twice is computed once. Swapping
 * back composes to the identity and names the untransposed base, which is still
 * resident because the sweep keeps a payload and its views together - so undoing
 * a transposition moves no bytes at all.
 *
 * A trace whose payload has no key (one a transform already replaced) still
 * transposes, it just cannot be memoised.
 */
const transposePayload = async (
  payload: {
    value: AxisData;
    ref?: string;
    shape?: number[];
    /** Whether the caller stores a shape and therefore needs one back. */
    needsShape: boolean;
  },
  newPositions: number[],
): Promise<{ value: AxisData; ref?: string; shape?: number[] }> => {
  const key = payload.ref
    ? transposedKey(payload.ref, newPositions)
    : undefined;
  const known = readPayload(key);
  // A shape the caller needs but the registry has never recorded is one only
  // the tensor can produce.
  const knownShape =
    payloadShape(key) ??
    (payload.shape && permuteShape(payload.shape, newPositions));
  if (key && known && (knownShape || !payload.needsShape)) {
    return { value: known, ref: key, shape: knownShape };
  }

  const tensor = await transposeMatrix(payload.value, newPositions);
  const transposed = (await tensor.array()) as AxisData;
  if (key) registerPayload(key, transposed, tensor.shape);
  return { value: transposed, ref: key, shape: tensor.shape };
};

async function transposeAxis(
  updatedDataPlot: DataGridPlot,
  axeIndexToSwap: number,
  axeIndexOfTargetAxis: number,
) {
  const newPositions = transposePermutation(
    updatedDataPlot.coordinates,
    axeIndexToSwap,
    axeIndexOfTargetAxis,
  );

  // Modify each plot in graph
  for (const plotToTranspose of updatedDataPlot.plot) {
    const transposedY = await transposePayload(
      {
        value: plotToTranspose.yData,
        ref: plotToTranspose.yDataRef,
        shape: plotToTranspose.shape,
        needsShape: true,
      },
      newPositions,
    );
    plotToTranspose.yData = transposedY.value;
    plotToTranspose.yDataRef = transposedY.ref;
    plotToTranspose.shape = transposedY.shape;

    if (plotToTranspose?.error_bands) {
      for (const error_band of plotToTranspose.error_bands) {
        if (!isMatrixPlottable(error_band.yData)) {
          // Control to prevent from transposing error y axis when unplottable data
          continue;
        }
        const transposedBand = await transposePayload(
          {
            value: error_band.yData,
            ref: error_band.yDataRef,
            needsShape: false,
          },
          newPositions,
        );
        error_band.yData = transposedBand.value;
        error_band.yDataRef = transposedBand.ref;
      }
    }
  }
}

/**
 * The coordinates as the backend sent them: full payloads, with each cursor
 * shifted back onto the full vector it indexes a window of.
 *
 * Resolving a typed range against these, rather than against what the grid is
 * currently showing, is what makes a range absolute - and therefore what lets a
 * wider range be typed over a narrower one without restoring first.
 */
const baseCoordinates = (coordinates: Coordinates[]): Coordinates[] =>
  coordinates.map((coord) => {
    const key = coord.dataRef ? baseOf(coord.dataRef) : undefined;
    const base = readPayload(key);
    if (!base) return coord;
    return {
      ...coord,
      data: base,
      shape: payloadShape(key) ?? coord.shape,
      valueIndex: coord.valueIndex + (coord.range?.[0] ?? 0),
    };
  });

/** The untrimmed vector of one display axis. */
const baseVector = (coordinates: Coordinates[], axeIndex: number) =>
  getArrayValueFromDependance(baseCoordinates(coordinates), axeIndex);

/**
 * The windows that apply to one coordinate's own payload.
 *
 * A coordinate is windowed along its own axis by its own range, and along each
 * axis it depends on by that dependency's range - the dependency ordering is
 * reversed because dependencies are listed outermost-first and axes are not.
 */
const coordinateRanges = (
  coordinates: Coordinates[],
  coord: Coordinates,
  rank: number,
): Ranges => {
  const ranges: Ranges = {};
  const dependencies = [...(coord.coord_dependencies ?? [])].reverse();
  dependencies.forEach((name, axis) => {
    const dependency = coordinates.find((other) => other.name === name);
    if (dependency?.range && axis < rank) ranges[axis] = dependency.range;
  });
  if (coord.range) ranges[rank - 1] = coord.range;
  return ranges;
};

/**
 * The windows that apply to a trace's payload, in the axes of the **base**.
 *
 * Coordinates are ordered by the axis they are displayed on, which after a
 * transposition is no longer the axis they occupy in the fetched array, so each
 * one is carried back through the permutation the payload's key records.
 */
const plotRanges = (
  coordinates: Coordinates[],
  permutation: number[] | null,
  rank: number,
): Ranges => {
  const ranges: Ranges = {};
  [...coordinates]
    .sort(compareByAxeIndex)
    .reverse()
    .forEach((coord, displayedAxis) => {
      if (!coord.range || displayedAxis >= rank) return;
      const axis = permutation ? permutation[displayedAxis] : displayedAxis;
      ranges[axis] = coord.range;
    });
  return ranges;
};

/**
 * Re-cut every array of `grid` from its base at the ranges its coordinates
 * carry, and rebuild the vectors that are drawn from the result.
 *
 * Idempotent, because the ranges are absolute. That is the whole reason there is
 * one function here rather than an `applyRangeInCoord` and an
 * `applyRangeInPlot` threading a previous range and a list of traces that have
 * not been narrowed yet: running this after a trace arrives full, after one
 * arrives already narrowed, or twice in a row, all give the same grid.
 */
export const applyRangesToGrid = async (
  grid: DataGridPlot,
): Promise<DataGridPlot> => {
  const next = cloneGridStructure(grid);
  const coordinates = next.coordinates ?? [];

  for (const coord of coordinates) {
    const rank = await baseRank(coord.dataRef, coord.data);
    const derived = await sliceFromBase(
      coord.dataRef,
      coord.data,
      coordinateRanges(coordinates, coord, rank),
    );
    coord.data = derived.value;
    coord.dataRef = derived.ref;
    if (derived.shape) coord.shape = derived.shape;
  }

  for (const plot of next.plot ?? []) {
    const rank = await baseRank(plot.yDataRef, plot.yData);
    const derived = await sliceFromBase(
      plot.yDataRef,
      plot.yData,
      plotRanges(coordinates, transposeOf(plot.yDataRef), rank),
    );
    plot.yData = derived.value;
    plot.yDataRef = derived.ref;
    if (derived.shape) plot.shape = derived.shape;

    for (const error_band of plot.error_bands ?? []) {
      if (
        error_band.array?.length === 0 &&
        (error_band.path.endsWith('_error_upper') ||
          error_band.path.endsWith('_error_lower'))
      ) {
        // A band the backend has nothing for: there is no payload to window.
        continue;
      }
      const bandRank = await baseRank(error_band.yDataRef, error_band.yData);
      const derivedBand = await sliceFromBase(
        error_band.yDataRef,
        error_band.yData,
        plotRanges(coordinates, transposeOf(error_band.yDataRef), bandRank),
        false,
      );
      error_band.yData = derivedBand.value;
      error_band.yDataRef = derivedBand.ref;
    }
  }

  clampCursors(coordinates);
  return next;
};

/**
 * Move the cursor of a coordinate, and of everything indexed by it, back to the
 * start of the new window.
 */
const resetCursor = (coordinates: Coordinates[], updatedCoord: Coordinates) => {
  const lastTargetLastName = getLastIndexedField(updatedCoord.target);
  for (const coord of coordinates) {
    if (
      coord.name !== updatedCoord.name &&
      !(coord.coord_dependencies ?? []).includes(updatedCoord.name)
    ) {
      continue;
    }
    coord.valueIndex = 0;
    coord.path = updateIndexFieldName(coord.path, lastTargetLastName, 0);
    coord.target = updateIndexFieldName(coord.target, lastTargetLastName, 0);
  }
};

/**
 * Turn a typed value range into indices of the untrimmed coordinate vector.
 *
 * The indices returned are absolute, so they mean the same thing whatever range
 * is applied at the time - including none.
 */
export const getRangeIndex = (
  newValueRange: [number, number] | [string, string],
  updatedDataPlot: DataGridPlot,
  coordinate: Coordinates,
): [number, number] => {
  const coordToUpdate = updatedDataPlot.coordinates.find(
    (coord) => coord.name === coordinate.name,
  );
  const coordVector = baseVector(
    updatedDataPlot.coordinates,
    coordToUpdate.axeIndex,
  );
  let newRange: [number, number] = [0, coordVector.length - 1];

  const rangeMatched = [];
  if (typeof newValueRange[0] === 'number') {
    const min = newValueRange[0] as number;
    const max = newValueRange[1] as number;

    for (let i = 0; i < coordVector.length; i++) {
      // Matched against the value the plot draws, not the one the backend sent:
      // everything on the render path has been through a tfjs tensor, which is
      // single precision, and a bound typed as 0.6 has to pick the same point
      // the axis labels 0.6.
      const value = Math.fround(coordVector[i] as number);

      // Get min range
      if (rangeMatched.length === 0 && value >= min && value <= max) {
        rangeMatched.push(i);
      }

      // Get max range
      if (rangeMatched.length === 1 && value > max && i !== 0) {
        rangeMatched.push(i - 1);
        break;
      }
    }
    if (rangeMatched.length === 2) {
      newRange = rangeMatched as [number, number];
    } else if (rangeMatched.length === 1) {
      newRange[0] = rangeMatched[0];
    }
  } else if (typeof newValueRange[0] === 'string') {
    // Get index of first occurence
    const firstIndex = (coordVector as string[]).findIndex(
      (val) =>
        newValueRange[0] !== '' && val.includes(newValueRange[0] as string),
    );
    // Get index of last occurence
    let secondIndex = (coordVector as string[])
      .map((value) => value)
      .reverse()
      .findIndex(
        (val) =>
          newValueRange[1] !== '' && val.includes(newValueRange[1] as string),
      );
    if (secondIndex !== -1) {
      secondIndex = coordVector.length - 1 - secondIndex;
    }

    rangeMatched.push(firstIndex !== -1 ? firstIndex : 0);
    rangeMatched.push(
      secondIndex !== -1 ? secondIndex : coordVector.length - 1,
    );
    newRange = rangeMatched as [number, number];
  }
  return newRange;
};

/** The typed range, rendered back as the values the panel shows. */
const rangeValuesOf = (
  coordinates: Coordinates[],
  coord: Coordinates,
  newRange: [number, number],
  newValueRange: [number, number] | [string, string],
): [number, number] | [string, string] => {
  if (typeof newValueRange[0] !== 'string') {
    return newValueRange as [number, number];
  }
  const vector = baseVector(coordinates, coord.axeIndex) as string[];
  return [vector[newRange[0]], vector[newRange[1]]];
};

/**
 * Window `coordinate` to the typed value range, and re-cut the grid to match.
 *
 * Pure: the grid handed in is not touched, and the one handed back shares every
 * payload it did not have to change.
 *
 * @param keepCursor Leave the sliders where they are. Set when the range is not
 *   new - loading a saved configuration, or fitting a trace that has just
 *   arrived to the window the grid already has.
 */
export const applyRange = async (
  coordinate: Coordinates,
  newValueRange: [number, number] | [string, string],
  customizedDataGrid: DataGridPlot,
  keepCursor?: boolean,
) => {
  try {
    const next = cloneGridStructure(customizedDataGrid);
    const updatedCoord = next.coordinates.find(
      (coord) => coord.name === coordinate.name,
    );
    const newRange = getRangeIndex(newValueRange, next, coordinate);

    updatedCoord.range = newRange;
    updatedCoord.rangeValues = rangeValuesOf(
      next.coordinates,
      updatedCoord,
      newRange,
      newValueRange,
    );
    if (!keepCursor) resetCursor(next.coordinates, updatedCoord);

    return await applyRangesToGrid(next);
  } catch (error) {
    console.error('Error applying the range: ', error);
  }
};

/**
 * Drop `coordinate`'s window and re-cut the grid to the full payload.
 *
 * Costs nothing: the full array is the base, and the sweep keeps a payload and
 * its windows together, so it is still resident.
 */
export const restoreRangeInGrid = async (
  coordinate: Coordinates,
  customizedDataGrid: DataGridPlot,
) => {
  const next = cloneGridStructure(customizedDataGrid);
  const updatedCoord = next.coordinates.find(
    (coord) => coord.name === coordinate.name,
  );
  delete updatedCoord.range;
  delete updatedCoord.rangeValues;
  resetCursor(next.coordinates, updatedCoord);
  return applyRangesToGrid(next);
};

export function formatGeometriesToSave(
  geometries: Geometry[],
  dataURI: URIData[],
): Partial<Geometry>[] {
  const result: Partial<Geometry>[] = [];
  const geometryMap = new Map<string, Set<string>>();

  for (const geom of geometries) {
    const splittedUri = geom.geometry_node.split('#');

    const normalizedUri =
      splittedUri.length >= 0
        ? `${dataURI.find((uri) => uri.uri === splittedUri[0]).name}#${splittedUri[1]}`
        : geom.geometry_node;

    const match = normalizedUri.match(/(.*\/geometry\/)([^/]+)\/?$/);

    if (match) {
      const [, baseUri, parameter] = match;

      if (!geometryMap.has(baseUri)) {
        geometryMap.set(baseUri, new Set());
      }

      geometryMap.get(baseUri)!.add(parameter);
    } else {
      result.push({ geometry_node: normalizedUri, nodeUris: [] });
    }
  }

  for (const [geometry_node, parameters] of geometryMap.entries()) {
    result.push({
      geometry_node,
      nodeUris: [...parameters],
    });
  }

  return result;
}
