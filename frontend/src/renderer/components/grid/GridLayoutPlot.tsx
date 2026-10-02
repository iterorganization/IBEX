import { memo, useCallback, useEffect, useState } from 'react';
import {
  Configuration,
  Coordinates,
  CustomizedGridType,
  DataGridPlot,
  DataPlotly,
  GridLayoutPlotProps,
  NodeInfoTypeEnum,
  URITreeNodeData,
} from '../../../renderer/types';
import { Center, Container, Text } from '@mantine/core';
import { SimplePlotly, Heatmap2D } from '../plot';
import { useIbexStore } from '../../stores';
import { countRender } from '../../utils/perf';
import { normalizeIndices } from '../../utils';
import { lineVector } from '../../derive/vectors';
import { MetaDataInfos } from '../../pages/visualization/VisualizationMetaData';
import { HoverButtons } from './HoverButtons';

/**
 * One plot panel.
 *
 * Memoized on its props: `data` keeps its identity while that grid is
 * unchanged (the store writers preserve untouched grids), and the other two are
 * numbers. Without this, a store write anywhere re-renders every panel through
 * the parent's children array, and each re-render hands Plotly new props.
 */
export const GridLayoutPlot = memo(function GridLayoutPlot({
  data,
  colWidth,
  rowHeight,
}: GridLayoutPlotProps) {
  // Only `dataURI.length` is read while rendering; everything else is read at
  // call time inside the handlers. Subscribing to the whole store here made
  // every panel re-render - and redraw - on any change anywhere.
  const hasDataURI = useIbexStore((state) => state.active.dataURI.length > 0);
  // A boolean selector, so entering edit mode re-renders the two panels whose
  // flag changed and no others. `isEditing` used to be a field on every grid,
  // which meant the write had to rebuild the grids it cleared it on.
  const isEditing = useIbexStore((state) => state.editingGridId === data.i);
  countRender(`GridLayoutPlot:${data.i}`);
  const [heightGrid, setHeightGrid] = useState(
    data.h * rowHeight + (23 * (data.h * rowHeight)) / 100,
  );
  const [widthGrid, setWidthGrid] = useState(Math.floor(data.w * colWidth));
  const [is3DView, setIs3DView] = useState<boolean>(
    data?.selectedPlotMode === 'Heatmap' || data?.selectedPlotMode === 'Contour'
      ? true
      : false,
  );
  const [active3DTab, setActive3DTab] = useState<string>('0');
  const [metadataTabsValue, setMetadataTabsValue] = useState<string>(
    data.plot[0]?.path || '',
  );
  const [shouldDisplayMetadata, setShouldDisplayMetadata] = useState(false);

  /**
   * Move a coordinate's cursor.
   *
   * One store action writing integers and labels. What is drawn is derived from
   * the payload and those integers at render time, so this no longer rebuilds
   * every trace of this grid and of every grid synchronized with it - which is
   * why its cost no longer depends on how big the payload is.
   */
  const handleUpdateCoordinate = useCallback(
    async (coordinate: Coordinates, valueIndex: number) => {
      useIbexStore.getState().setCursor(data.i, coordinate.name, valueIndex);
    },
    [data.i],
  );

  useEffect(() => {
    let forceToDisplayMetadata = false;

    // Rule to force to show metadata when y data is of type string
    let isYDataString = false;
    for (const plot of data.plot) {
      const drawn = lineVector(plot.yData, data.coordinates);
      if (drawn && typeof drawn[0] === 'string') {
        isYDataString = true;
      }
    }

    // Rule to force to show metadata when y data is a geometry
    let isGeometry = false;
    if (data.is_geometry_node === true) {
      isGeometry = true;
    }

    forceToDisplayMetadata = isYDataString || isGeometry;
    setShouldDisplayMetadata(forceToDisplayMetadata);
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

  useEffect(() => {
    setIs3DView(
      data?.selectedPlotMode === 'Heatmap' ||
        data?.selectedPlotMode === 'Contour'
        ? true
        : false,
    );
  }, [data.selectedPlotMode]);

  /**
   * Handle the delete grid event
   */
  const handleDeleteGrid = useCallback((id: string) => {
    const { active, updatedConfiguration, editingGridId, setEditingGrid } =
      useIbexStore.getState();
    const newDataPlot: DataGridPlot[] = active.dataPlot.filter(
      (item: DataGridPlot) => item.i !== id,
    );
    // Deleting the grid being edited leaves edit mode; deleting another one
    // leaves the tree selection alone. The panels keyed on this grid close
    // with it - `updatedConfiguration` below prunes them.
    const stillEditing = newDataPlot.some((item) => item.i === editingGridId);
    if (!stillEditing) setEditingGrid(null);
    const checkedNodeURI = stillEditing ? active.checkedNodeURI : [];
    const newActive: Configuration = {
      ...active,
      saved: false,
      dataPlot: newDataPlot,
      checkedNodeURI: checkedNodeURI,
    };

    // Remove from synchronized relations deleted dataGrid
    const oldDataPlot = active.dataPlot.find(
      (item: DataGridPlot) => item.i === id,
    );
    for (const synchronizedId of oldDataPlot.synchronizedGrids.list) {
      const dataPlotToUpdate = newDataPlot.find(
        (dp) => synchronizedId === dp.i,
      );
      const updatedList = dataPlotToUpdate.synchronizedGrids.list.filter(
        (id) => id !== oldDataPlot.i,
      );
      dataPlotToUpdate.synchronizedGrids = {
        color:
          updatedList.length > 0
            ? dataPlotToUpdate.synchronizedGrids.color
            : '',
        list: updatedList,
      };
    }

    updatedConfiguration(newActive);
  }, []);

  /**
   * Handle edit grid event
   */
  const handleEditGrid = useCallback((id: string) => {
    const { active, updatedConfiguration, editingGridId, setEditingGrid } =
      useIbexStore.getState();

    const findPlot = active.dataPlot.find((item) => item.i === id);
    if (!findPlot) return;

    // Edit mode is a single id, so leaving it touches no grid object at all -
    // it used to clear a flag on every other grid, and the grids it rebuilt to
    // do so were what made editing one panel re-render the rest.
    const wasEditing = editingGridId === id;
    setEditingGrid(wasEditing ? null : id);

    // Check from tree selected plots (all plots used in dataGrid)
    const checkedNodeURI: URITreeNodeData[] = !wasEditing
      ? findPlot.plot.map((item) => ({
          uri: normalizeIndices(item.nodeUri),
          name: item.labelUri,
          type: findPlot.dataType,
          is_geometry_node: findPlot.is_geometry_node,
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
            is_geometry_node: findPlot.is_geometry_node,
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

      if (findPlot?.geometries) {
        // Check geometries in tree
        for (const geometry of findPlot.geometries) {
          for (const uriOfGeo of geometry.nodeUris) {
            const newCheckedNode = {
              name: findPlot.plot[0].labelUri,
              uri: normalizeIndices(uriOfGeo),
              type: NodeInfoTypeEnum.FLOAT,
              is_geometry_node: true,
            } as URITreeNodeData;
            const exists = checkedNodeURI.some(
              (node) =>
                node.name === newCheckedNode.name &&
                node.uri === newCheckedNode.uri,
            );
            if (!exists) {
              checkedNodeURI.push(newCheckedNode);
            }
          }
        }
      }
    }

    const updatedActive: Configuration = {
      ...active,
      saved: false,
      checkedNodeURI: checkedNodeURI,
    };

    updatedConfiguration(updatedActive);
  }, []);

  /**
   * Inspect metadata of plot
   */
  const handleInspectMetadata = useCallback((id: string) => {
    // Which panel is open is not part of the saved configuration, so opening
    // one no longer replaces it.
    useIbexStore.getState().setMetadataGrid(id);
  }, []);

  /**
   * Customize plot
   */
  const handleCustomization = useCallback(
    (id: string, typeOfEdition: CustomizedGridType) => {
      useIbexStore.getState().setCustomizing({ id, type: typeOfEdition });
    },
    [],
  );

  return (
    <Container fluid w={widthGrid} p={0}>
      {hasDataURI && (
        <HoverButtons
          data={data}
          isEditing={isEditing}
          shouldDisplayMetadata={shouldDisplayMetadata}
          handleEditGrid={handleEditGrid}
          handleInspectMetadata={handleInspectMetadata}
          handleCustomization={handleCustomization}
          handleDeleteGrid={handleDeleteGrid}
          is3DView={is3DView}
          active3DTab={active3DTab}
          setActive3DTab={setActive3DTab}
        />
      )}

      {!hasDataURI ? (
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
                  key={`metadata_${data.i}`}
                  gridLayoutKey={data.i}
                  data={plot}
                  gridCoordinates={data.coordinates}
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
          isEditing={isEditing}
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
          isEditing={isEditing}
          width={widthGrid}
          height={heightGrid}
          showSliders={true}
          is3DView={is3DView}
          handleUpdateCoordinate={handleUpdateCoordinate}
        />
      )}
    </Container>
  );
});
