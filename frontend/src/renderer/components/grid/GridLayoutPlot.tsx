import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  Axis,
  Configuration,
  Coordinates,
  DataGridPlot,
  DataPlotly,
  GridLayoutPlotProps,
  URITreeNodeData,
} from '../../../renderer/types';
import { Center, Container, Text } from '@mantine/core';
import { SimplePlotly, Heatmap2D } from '../plot';
import { useIbexStore } from '../../stores';
import {
  containsFloat,
  getArrayValueFromDependance,
  getErrorYVectors,
  getLastIndexedField,
  getVectorData,
  limitSlidersToMaxLength,
  normalizeIndices,
  updateIndexFieldName,
} from '../../utils';
import { MetaDataInfos } from '../../pages/visualization/VisualizationMetaData';
import { HoverButtons } from './HoverButtons';

export const GridLayoutPlot = ({
  data,
  colWidth,
  rowHeight,
}: GridLayoutPlotProps) => {
  const { active, updatedConfiguration } = useIbexStore();
  const [heightGrid, setHeightGrid] = useState(
    data.h * rowHeight + (23 * (data.h * rowHeight)) / 100,
  );
  const [widthGrid, setWidthGrid] = useState(Math.floor(data.w * colWidth));
  const [is3DView, setIs3DView] = useState<boolean>(false);
  const [active3DTab, setActive3DTab] = useState<string>('0');
  const [metadataTabsValue, setMetadataTabsValue] = useState<string>(
    data.plot[0]?.path || '',
  );
  const [shouldDisplayMetadata, setShouldDisplayMetadata] = useState(false);

  /**
   * updateslider coordinate value
   */
  const handleUpdateCoordinate = async (
    coordinate: Coordinates,
    valueIndex: number,
  ) => {
    // Check if the coordinate has a target
    const lastTargetLastName = getLastIndexedField(coordinate.target);
    if (!lastTargetLastName)
      return console.warn('No indexed field found in target');

    // Update coordinates targets & paths with new valueIndex
    const updatedCoordinatesValue = data.coordinates.map((item) => {
      const lastTargetLastName = getLastIndexedField(coordinate.target);

      const updatedPath = updateIndexFieldName(
        item.path,
        lastTargetLastName,
        valueIndex,
      );
      const updatedTarget = updateIndexFieldName(
        item.target,
        lastTargetLastName,
        valueIndex,
      );

      return {
        ...item,
        path: updatedPath,
        target: updatedTarget,
        valueIndex:
          item.name === coordinate.name ? valueIndex : item.valueIndex,
      };
    }) as Coordinates[];

    limitSlidersToMaxLength(updatedCoordinatesValue);

    const updatedActive: Configuration = {
      ...active,
      dataPlot: active.dataPlot.map((item: DataGridPlot) => {
        if (item.i === data.i) {
          const updatedXAxisData: Axis = {
            ...data.xAxisData,
            path: updateIndexFieldName(
              data.xAxisData?.path || '',
              lastTargetLastName,
              valueIndex,
            ),
          };

          // Get x values switch x dependances
          const newXData = getArrayValueFromDependance(
            updatedCoordinatesValue,
            0,
          );

          const updatedPlot = data.plot.map((plotItem) => {
            const updatedNodeUri = updateIndexFieldName(
              plotItem.nodeUri,
              lastTargetLastName,
              valueIndex,
            );

            const updatedPath = updateIndexFieldName(
              plotItem.path || '',
              lastTargetLastName,
              valueIndex,
            );

            const newYData = getVectorData(
              updatedCoordinatesValue,
              plotItem.yData,
            );

            if (plotItem?.error_bands?.length) {
              const updated_error_y = getErrorYVectors(
                plotItem,
                updatedCoordinatesValue,
              );
              return {
                ...plotItem,
                x: newXData,
                y: newYData,
                error_y: updated_error_y,
                nodeUri: updatedNodeUri,
                path: updatedPath,
              };
            } else {
              return {
                ...plotItem,
                x: newXData,
                y: newYData,
                nodeUri: updatedNodeUri,
                path: updatedPath,
              };
            }
          });

          return {
            ...data,
            coordinates: updatedCoordinatesValue,
            plot: updatedPlot,
            xAxisData: updatedXAxisData,
          };
        }

        return item;
      }) as DataGridPlot[],
    };

    updatedConfiguration(updatedActive);
  };

  useEffect(() => {
    // Rule to force to show metadata when y data is of type string
    let isYDataString = false;
    for (const plot of data.plot) {
      if (plot.y) {
        const typeOfYData = typeof plot.y[0];
        if (typeOfYData === 'string') {
          isYDataString = true;
        }
      }
    }
    setShouldDisplayMetadata(isYDataString);
  }, [data.plot.length]);

  /**
   * Handle resize the grid
   */
  useEffect(() => {
    setHeightGrid(data.h * rowHeight + (23 * (data.h * rowHeight)) / 100);
    setWidthGrid(Math.floor(data.w * colWidth));
  }, [data.h, rowHeight, data.w, colWidth]);

  useEffect(() => {
    if (parseInt(active3DTab) > data.plot.length - 1) {
      setActive3DTab('0');
    }

    // Update metadataTabsValue for metadata when removing selected tab
    if (
      !data.plot.find((plot: DataPlotly) => plot.path === metadataTabsValue)
    ) {
      setMetadataTabsValue(data.plot[0]?.path);
    }
  }, [data.plot]);

  const updateSelectedPlotMode = (is3DView: boolean, active: Configuration) => {
    const updatedDataPlot: DataGridPlot[] = JSON.parse(
      JSON.stringify(active.dataPlot),
    );
    const selectedDataPlot = updatedDataPlot.find(
      (dataPlot) => dataPlot.i === data.i,
    );
    if (selectedDataPlot?.selectedPlotMode) {
      selectedDataPlot.selectedPlotMode = is3DView ? 'Heatmap' : '1D';
    } else {
      selectedDataPlot.selectedPlotMode =
        data.coordinates.length >= 2 &&
        containsFloat(
          data.coordinates.find((coord) => coord.axeIndex === 1).data,
        )
          ? 'Heatmap'
          : '1D';
    }

    const updatedActive: Configuration = {
      ...active,
      dataPlot: updatedDataPlot,
    };
    updatedConfiguration(updatedActive);
  };

  useLayoutEffect(() => {
    if (data?.selectedPlotMode) {
      setIs3DView(data.selectedPlotMode === 'Heatmap');
    } else {
      setIs3DView(
        data.coordinates.length >= 2 &&
          containsFloat(
            data.coordinates.find((coord) => coord.axeIndex === 1).data,
          ),
      );
    }
  }, []);

  useEffect(() => {
    updateSelectedPlotMode(is3DView, active);
  }, [is3DView]);

  /**
   * Handle the delete grid event
   */
  const handleDeleteGrid = useCallback((id: string) => {
    const { active, updatedConfiguration } = useIbexStore.getState();
    const newDataPlot: DataGridPlot[] = active.dataPlot.filter(
      (item: DataGridPlot) => item.i !== id,
    );
    const checkedNodeURI = newDataPlot.find((dataPlot) => dataPlot.isEditing)
      ? active.checkedNodeURI
      : [];
    const newActive: Configuration = {
      ...active,
      saved: false,
      dataPlot: newDataPlot,
      checkedNodeURI: checkedNodeURI,
    };
    updatedConfiguration(newActive);
  }, []);

  /**
   * Handle edit grid event
   */
  const handleEditGrid = useCallback(
    (id: string) => {
      const { active, updatedConfiguration } = useIbexStore.getState();

      const findPlot = active.dataPlot.find((item) => item.i === id);
      if (!findPlot) return;

      const updatedDataPlot = active.dataPlot.map((item) =>
        item.i === id
          ? { ...item, isEditing: !item.isEditing, static: !item.isEditing }
          : { ...item, isEditing: false, static: false },
      );

      // Check from tree selected plots (all plots used in dataGrid)
      const checkedNodeURI: URITreeNodeData[] = !findPlot.isEditing
        ? findPlot.plot.map((item) => ({
            uri: normalizeIndices(item.nodeUri),
            name: item.labelUri,
            type: findPlot.dataType,
          }))
        : [];

      if (checkedNodeURI.length) {
        for (const plot of findPlot.plot) {
          if (!plot.error_bands) {
            continue;
          }

          for (const error_band of plot.error_bands) {
            const newCheckedNode = {
              name: plot.labelUri,
              uri: normalizeIndices(error_band.path),
              type: findPlot.dataType,
            };
            const exists = checkedNodeURI.some(
              (node) =>
                node.name === newCheckedNode.name &&
                node.uri === newCheckedNode.uri,
            );
            if (!exists) {
              // Check from tree selected error bands to plot
              checkedNodeURI.push(newCheckedNode);
            }
          }
        }
      }

      const updatedActive: Configuration = {
        ...active,
        saved: false,
        dataPlot: updatedDataPlot,
        checkedNodeURI: checkedNodeURI,
      };

      updatedConfiguration(updatedActive);
    },
    [active],
  );

  /**
   * Inspect metadata of plot
   */
  const handleInspectMetadata = useCallback(
    (id: string) => {
      const updatedDataPlot: DataGridPlot[] = JSON.parse(
        JSON.stringify(active.dataPlot),
      );
      updatedDataPlot.find((dataPlot) => dataPlot.i === id).isEditing = false;

      const updatedActive: Configuration = {
        ...active,
        metadataGridLayout: id,
        dataPlot: updatedDataPlot,
        checkedNodeURI: [],
      };
      updatedConfiguration(updatedActive);
    },
    [active],
  );

  /**
   * Customize plot
   */
  const handleCustomization = useCallback(
    (id: string) => {
      const updatedDataPlotList: DataGridPlot[] = JSON.parse(
        JSON.stringify(active.dataPlot),
      );
      const updatedDataPlot = updatedDataPlotList.find(
        (dataPlot: DataGridPlot) => dataPlot.i === id,
      );
      updatedDataPlot.isEditing = false;

      const updatedActive: Configuration = {
        ...active,
        customizedGridLayout: id,
        dataPlot: updatedDataPlotList,
        checkedNodeURI: [],
      };
      updatedConfiguration(updatedActive);
    },
    [active],
  );

  return (
    <Container fluid w={widthGrid} p={0}>
      {active.dataURI.length > 0 && (
        <HoverButtons
          data={data}
          shouldDisplayMetadata={shouldDisplayMetadata}
          handleEditGrid={handleEditGrid}
          handleInspectMetadata={handleInspectMetadata}
          handleCustomization={handleCustomization}
          handleDeleteGrid={handleDeleteGrid}
          is3DView={is3DView}
          setIs3DView={setIs3DView}
          active3DTab={active3DTab}
          setActive3DTab={setActive3DTab}
        />
      )}

      {!(active.dataURI.length > 0) ? (
        // Control when loading a template without selecting URIs
        <Center h={heightGrid}>
          <Text>Current configuration has no data. Please, select URIs.</Text>
        </Center>
      ) : !data.coordinates.length || shouldDisplayMetadata ? (
        <Container pt="40px" p="1rem">
          {data.plot.map((plot: DataPlotly, index) => {
            return (
              index.toString() === active3DTab && (
                <MetaDataInfos
                  gridLayoutKey={data.i}
                  data={plot}
                  yAxis={plot.yaxis !== '' ? data.y2AxisData : data.yAxisData}
                  height={(heightGrid - 72).toString()} // 72px is equivalent to paddings (40px from top + 2rem for y padding)
                  tabsSelected={plot.path}
                />
              )
            );
          })}
        </Container>
      ) : is3DView ? (
        // Show heatmap
        <Heatmap2D
          itemDataGrid={data}
          width={widthGrid}
          height={heightGrid}
          plotIndex={active3DTab}
          showSliders={true}
          handleUpdateCoordinate={handleUpdateCoordinate}
        />
      ) : (
        // Show simple plot
        <SimplePlotly
          itemDataGrid={data}
          width={widthGrid}
          height={heightGrid}
          showSliders={true}
          is3DView={is3DView}
          handleUpdateCoordinate={handleUpdateCoordinate}
        />
      )}
    </Container>
  );
};
