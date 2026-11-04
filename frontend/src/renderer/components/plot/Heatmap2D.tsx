import Plot from 'react-plotly.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Data, Layout } from 'plotly.js';
import { Axis, Configuration, Coordinates, DataGridPlot } from '../../types';
import classe from './SimplePlotly.module.css';
import { Center, Grid, Group, Select, Stack, Text } from '@mantine/core';
import { VerticalSlider } from '../verticalSlider';
import {
  compareByAxeIndex,
  emptyUserRelayout,
  getArrayValueFromDependance,
  getFirstArrayValueFromShape,
  isMatrixPlottable,
  mergeAxisRelayout,
  normalizeIndices,
  swapAxis,
  UserRelayout,
} from '../../utils';
import classes from './Heatmap2D.module.css';
import { useIbexStore } from '../../stores';
import { countRedraw, countRender } from '../../utils/perf';
import { axisVector, slabMatrix } from '../../derive/vectors';
import { getPlotConfig } from './plotConfig';
import { NoDataForURI } from '.';
import { usePlotLayout } from './hooks/usePlotLayout';
import { IconLink } from '@tabler/icons-react';

interface Heatmap2DProps {
  itemDataGrid: DataGridPlot;
  /**
   * Whether this grid is the one being edited. Optional because the
   * customization and metadata previews render a detached copy of a grid: they
   * are not an editing surface, which is what the title guard below always
   * meant to say.
   */
  isEditing?: boolean;
  width: number;
  height: number;
  plotIndex: string;
  showSliders: boolean;
  forcedPlotType?: 'heatmap' | 'contour';
  handleUpdateCoordinate?: (
    coordinate: Coordinates,
    valueIndex: number,
  ) => Promise<void>;
}

export const Heatmap2D = ({
  itemDataGrid,
  isEditing = false,
  width,
  height,
  plotIndex,
  showSliders,
  forcedPlotType,
  handleUpdateCoordinate,
}: Heatmap2DProps) => {
  countRender(`Heatmap2D:${itemDataGrid.i}`);
  const handleAfterPlot = useCallback(
    () => countRedraw(itemDataGrid.i),
    [itemDataGrid.i],
  );
  const coordsUsedInAxes: 1 | 2 = 2;
  const SELECT_AXIS_HEIGHT = 90; // Height of the select axis container
  const plotRef = useRef<Plot | null>(null);
  const selectedPlot = itemDataGrid.plot[parseInt(plotIndex)];

  // The three vectors the heatmap draws, and the three axis descriptors, all
  // derived in one pass from the payload and the cursor. They used to be six
  // pieces of state filled by a chain of effects, so one slider tick produced a
  // render - and a Plotly redraw - per link in the chain.
  const { xAxis, yAxis, zAxis, x, y, z } = useMemo(() => {
    const coordinates = itemDataGrid.coordinates ?? [];
    const xCoord = coordinates.find((coord) => coord.axeIndex === 0);
    const yCoord = coordinates.find((coord) => coord.axeIndex === 1);
    return {
      xAxis: xCoord && ({ name: xCoord.name, unit: xCoord.unit } as Axis),
      yAxis: yCoord && ({ name: yCoord.name, unit: yCoord.unit } as Axis),
      zAxis: {
        name:
          selectedPlot?.name.replace(`_${selectedPlot.labelUri}`, '') ||
          'Z Axis',
        unit: selectedPlot?.unit || '',
      } as Axis,
      x: axisVector(coordinates, 0) as number[],
      y: axisVector(coordinates, 1) as number[],
      z: slabMatrix(selectedPlot?.yData, coordinates),
    };
  }, [itemDataGrid.coordinates, selectedPlot]);

  const are3DAxisInit = Boolean(selectedPlot?.yData && x && y && z);
  // Axis types and grid display, derived rather than pushed into the layout by
  // effects: Plotly compares `layout` by reference, so every push was a redraw.
  const axisLayout = usePlotLayout({ itemDataGrid });
  // What the user changed with the mode bar (zoom, pan, autorange); merged last
  // so rebuilding the layout never discards it.
  const [userRelayout, setUserRelayout] =
    useState<UserRelayout>(emptyUserRelayout);
  const [title, setTitle] = useState(itemDataGrid.title);
  const layoutPlotWidth = showSliders ? width * 0.8 : width;

  /**
   * Update the editable title when layout title change
   */
  useEffect(() => {
    if (!itemDataGrid.isTitleOverwritten) {
      setTitle(itemDataGrid.title || '');
    }
  }, [itemDataGrid.title]);

  /**
   * Update the layout title & dataPlot configuration when editing title
   */
  useEffect(() => {
    // The store is read here rather than subscribed to: this component only
    // ever writes to it, and subscribing would re-render - and so redraw
    // Plotly - on every unrelated change elsewhere in the configuration.
    const { active, updatedConfiguration } = useIbexStore.getState();

    if (!isEditing) {
      // Update active dataplot title only when editing (to prevent from updating in customization)
      return;
    }

    const updatedDataPlot: DataGridPlot[] = active.dataPlot.map(
      (item: DataGridPlot) => {
        if (item.i === itemDataGrid.i) {
          return {
            ...itemDataGrid,
            title: title,
          };
        }
        return item;
      },
    );

    const newActive: Configuration = {
      ...active,
      saved: false,
      dataPlot: updatedDataPlot,
    };

    updatedConfiguration(newActive);
  }, [title]);

  const handleRelayout = useCallback((newLayout: Partial<Layout>) => {
    setUserRelayout((previous) => mergeAxisRelayout(previous, newLayout));
  }, []);

  // A zoom belongs to the nodes it was made on: indices are normalised away so
  // that stepping a coordinate slider - which rewrites every `nodeUri` - keeps
  // it, while pointing the panel at other data drops it.
  const plottedNodes = itemDataGrid.plot
    .map((plot) => normalizeIndices(plot.nodeUri))
    .join('|');
  useEffect(() => {
    setUserRelayout((previous) =>
      previous === emptyUserRelayout ? previous : emptyUserRelayout,
    );
  }, [plottedNodes]);

  /**
   * The whole Plotly layout, derived in one go: the axis titles from the axes
   * `init3DAxis` resolved, the axis types and the grid from `usePlotLayout`,
   * the 1:1 ratio from the grid's own rule, and the user's mode bar changes
   * merged last.
   */
  const layoutPlot = useMemo<Partial<Layout>>(() => {
    const XTitle = xAxis?.name
      ? `${xAxis?.name} ${(xAxis?.unit && '[' + xAxis.unit + ']') || ''}`
      : '';
    const YTitle = yAxis?.name
      ? `${yAxis?.name} ${(yAxis?.unit && '[' + yAxis.unit + ']') || ''}`
      : '';

    // A category y axis whenever the second coordinate holds strings - what
    // init3DAxis used to push into the layout once it had resolved the axes.
    const yCoord = itemDataGrid.coordinates?.find(
      (coord) => coord.axeIndex === 1,
    );
    const yTypeFromCoordinate = yCoord
      ? typeof getFirstArrayValueFromShape(yCoord.data, yCoord.shape)[0] ===
        'string'
        ? 'category'
        : 'linear'
      : undefined;

    return {
      autosize: true,
      title: { text: itemDataGrid.title },
      height: height,
      width: layoutPlotWidth - 75,
      scene: {
        xaxis: { title: { text: '' } },
        yaxis: { title: { text: '' } },
        zaxis: { title: { text: '' } },
      },
      xaxis: {
        exponentformat: 'power',
        showexponent: 'all',
        separatethousands: true,
        zeroline: false,
        ...axisLayout.xaxis,
        scaleanchor: itemDataGrid.forceXyRatio ? 'y' : null,
        scaleratio: itemDataGrid.forceXyRatio ? 1 : null,
        title: { text: XTitle },
        ...userRelayout.axes.xaxis,
      },
      yaxis: {
        exponentformat: 'power',
        showexponent: 'all',
        separatethousands: true,
        zeroline: false,
        ...axisLayout.yaxis,
        ...(yTypeFromCoordinate ? { type: yTypeFromCoordinate } : {}),
        title: { text: YTitle },
        ...userRelayout.axes.yaxis,
      },
      modebar: {
        orientation: 'v',
      },
      legend: {
        x: 1.3,
        y: 1,
        groupclick: 'togglegroup',
        tracegroupgap: 0,
      },
      ...userRelayout.layout,
    };
  }, [
    xAxis,
    yAxis,
    itemDataGrid.title,
    itemDataGrid.forceXyRatio,
    itemDataGrid.coordinates,
    height,
    layoutPlotWidth,
    axisLayout,
    userRelayout,
  ]);

  /**
   * Plotly compares `data` by reference, so this array must keep its identity
   * while nothing it depends on changes. `x`, `y` and `z` already hold private
   * copies, made where they are computed, so nothing is copied here.
   */
  const plotData = useMemo<Data[]>(
    () => [
      {
        type: forcedPlotType
          ? forcedPlotType
          : itemDataGrid.selectedPlotMode === 'Heatmap'
            ? 'heatmap'
            : itemDataGrid.selectedPlotMode === 'Contour'
              ? 'contour'
              : 'heatmap',
        contours: {
          coloring: 'lines',
        },
        colorscale: selectedPlot?.customPreferences?.colorscale || 'Viridis',
        colorbar: {
          title: {
            text: zAxis?.name
              ? `${zAxis?.name} ${(zAxis?.unit && '[' + zAxis.unit + ']') || ''}`
              : '',
          },
          exponentformat: 'power',
          showexponent: 'all',
          separatethousands: true,
        },
        hovertemplate:
          'x: %{x}<br>' + 'y: %{y}<br>' + 'z: %{z:,.6g}<extra></extra>',
        x,
        y,
        z,
      },

      // Add geometries in contour type
      ...(itemDataGrid?.geometries ?? []),
    ],
    [
      forcedPlotType,
      itemDataGrid.selectedPlotMode,
      itemDataGrid?.geometries,
      selectedPlot?.customPreferences?.colorscale,
      zAxis?.name,
      zAxis?.unit,
      x,
      y,
      z,
    ],
  );

  return (
    <Grid
      styles={{
        inner: {
          margin: 0,
          width: 'inherit',
          flexWrap: 'nowrap',
          whiteSpace: 'nowrap',
        },
      }}
      mt={10}
    >
      {itemDataGrid.coordinates.filter((coord) => coord.name !== '')?.length >
        0 &&
        showSliders && (
          <>
            <Grid.Col
              className={classes.handlePlotExplorationContainer}
              span="content"
              mt={25}
            >
              <Stack gap={5}>
                {['x', 'y'].map((targetAxis: 'x' | 'y', axisIndex) => (
                  <Group key={`handle_axis_${axisIndex}`} gap={5}>
                    <Text>{targetAxis}</Text>
                    <Select
                      label=""
                      data-testid={`heatmap-axis-${targetAxis}-${itemDataGrid.i}`}
                      value={
                        itemDataGrid.coordinates.find(
                          (coord: Coordinates) =>
                            coord.axeIndex === (targetAxis === 'y' ? 1 : 0),
                        ).name
                      }
                      data={(itemDataGrid.geometries.length // In contour plot, allow to transpose only x & y to keep compatibles coordinates with geometries
                        ? itemDataGrid.coordinates.filter(
                            (coord) =>
                              coord.axeIndex === 0 || coord.axeIndex === 1,
                          )
                        : itemDataGrid.coordinates
                      ).map((coord: Coordinates) => coord.name)}
                      w={`${width * 0.2}px`}
                      onChange={(value) =>
                        value &&
                        swapAxis(
                          itemDataGrid,
                          itemDataGrid.coordinates.find(
                            (coord: Coordinates) => coord.name === value,
                          ).axeIndex,
                          targetAxis === 'x' ? 0 : 1,
                          false,
                          useIbexStore.getState().active,
                          useIbexStore.getState().updatedConfiguration,
                        )
                      }
                      size="xs"
                      disabled={!isEditing}
                    />
                  </Group>
                ))}
              </Stack>

              <Group
                justify="space-between"
                gap="0"
                w={`${width * 0.2}px`}
                miw={`${(itemDataGrid.coordinates.length - coordsUsedInAxes) * 50}px`}
                align="flex-end"
                pos="relative"
              >
                {structuredClone(itemDataGrid.coordinates)
                  .sort(compareByAxeIndex)
                  .map(
                    (item: Coordinates, valueIndex: number) =>
                      item.axeIndex !== 0 &&
                      item.axeIndex !== 1 && ( // Don't return slider linked to x & y
                        <VerticalSlider
                          key={`heatmap_slider_${valueIndex}`}
                          name={item.name}
                          valueIndex={item.valueIndex || 0}
                          data={getArrayValueFromDependance(
                            itemDataGrid.coordinates,
                            item.axeIndex,
                          )}
                          getValue={(valueIndex) =>
                            handleUpdateCoordinate(item, valueIndex)
                          }
                          maxWidth={
                            itemDataGrid.coordinates.length &&
                            itemDataGrid.coordinates.length > coordsUsedInAxes
                              ? 100 /
                                (itemDataGrid.coordinates.length -
                                  coordsUsedInAxes)
                              : 100
                          }
                          height={height - 80 - SELECT_AXIS_HEIGHT}
                          disabled={!isEditing}
                        />
                      ),
                  )}
                {itemDataGrid.synchronizedGrids.list.length && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 12,
                      ...(itemDataGrid.coordinates.length > 2
                        ? { right: -20 }
                        : { left: 0 }),
                    }}
                  >
                    <IconLink
                      size={20}
                      color={itemDataGrid.synchronizedGrids.color}
                    />
                  </div>
                )}
              </Group>
            </Grid.Col>
          </>
        )}

      {are3DAxisInit && [x, y, z].every(isMatrixPlottable) ? (
        <Grid.Col
          span="auto"
          pos="relative"
          w={`${layoutPlotWidth - 32}px`}
          maw={`${layoutPlotWidth - 32}px`}
          h={`${height}px`}
          style={{
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Plot
            ref={plotRef}
            data={plotData}
            config={getPlotConfig(isEditing)}
            layout={layoutPlot}
            onRelayout={handleRelayout}
            onAfterPlot={handleAfterPlot}
            useResizeHandler={false}
            className={classe.plot2D}
          />
        </Grid.Col>
      ) : are3DAxisInit && ![x, y, z].some(isMatrixPlottable) ? (
        <Grid.Col
          span="auto"
          pos="relative"
          w={'100%'}
          h={`${height}px`}
          style={{
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Center h={height}>
            <NoDataForURI
              itemDataGrid={itemDataGrid}
              selectedPlot={selectedPlot}
            />
          </Center>
        </Grid.Col>
      ) : (
        <Grid.Col
          span="auto"
          pos="relative"
          w={`${width}px`}
          maw={`${width}px`}
          h={`${height}px`}
          style={{
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Center h={height}>
            <Text>{are3DAxisInit ? 'Current index has no data' : ''}</Text>
          </Center>
        </Grid.Col>
      )}
    </Grid>
  );
};
