import { Paper, ScrollArea, Stack, Text } from '@mantine/core';
import { useIbexStore } from '../../stores';
import { useCallback, useState, useRef, useEffect } from 'react';
import { Configuration, DataGridPlot } from 'src/renderer/types';
import GridLayout, { Layout } from 'react-grid-layout';
import { GridLayoutPlot } from '../../components';

interface VisualizationPlotProps {
  extended?: boolean;
  height?: string;
}

export const VisualizationPlot = ({
  extended,
  height,
}: VisualizationPlotProps) => {
  const { active, updatedConfiguration } = useIbexStore();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const [dragEnabled, setDragEnabled] = useState(true);
  const [dragTimeout, setDragTimeout] = useState<NodeJS.Timeout | null>(null);
  const gridWith = extended ? 1800 : 1500;
  const colsNumber = 12;
  const colWidth = gridWith / colsNumber;
  const rowHeight = 30;

  /**
   * Handle the mouse down event
   */
  const handleMouseDown = () => {
    if (dragTimeout) clearTimeout(dragTimeout);
    setDragEnabled(false);

    const timeoutId = setTimeout(() => {
      setDragEnabled(true);
    }, 3000);

    setDragTimeout(timeoutId);
  };

  /**
   * Handle the mouse up event
   */
  const handleMouseUp = () => {
    if (dragTimeout) clearTimeout(dragTimeout);
    setDragEnabled(true);
  };

  /**
   * Handle update grid layout
   */
  const handleUpdateLayout = useCallback(
    (updatedLayouts: Layout[]) => {
      const updatedDataPlot: DataGridPlot[] = active.dataPlot.map(
        (item: DataGridPlot) => {
          const findUpdatedLayout = updatedLayouts.find(
            (layout) => layout.i === item.i,
          );

          if (findUpdatedLayout) {
            return {
              ...item,
              ...findUpdatedLayout,
              minH: 12,
              minW: 6,
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
    },
    [active],
  );

  /*
   * Scroll to the bottom of the scroll area when new data is added or removed
   */
  useEffect(() => {
    // Scroll to new plot
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [active.dataPlot.length]);

  return active.dataPlot.length > 0 ? (
    <>
      <ScrollArea h={height} viewportRef={scrollAreaRef}>
        <GridLayout
          cols={colsNumber}
          rowHeight={rowHeight}
          width={gridWith}
          autoSize={true}
          onDragStart={handleMouseDown}
          onDragStop={handleMouseUp}
          isDraggable={dragEnabled}
          onLayoutChange={(layout) => handleUpdateLayout(layout)}
        >
          {active.dataPlot.map((plotData: DataGridPlot) => {
            return (
              <Paper
                shadow="sm"
                radius="xs"
                withBorder
                key={plotData.i}
                data-grid={{
                  x: plotData.x,
                  y: plotData.y,
                  w: plotData.w,
                  h: plotData.h,
                  static: plotData.static,
                  minH: plotData.coordinates.length > 0 ? 12 : 8,
                  minW: plotData.coordinates.length > 0 ? 6 : 4,
                }}
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  boxSizing: 'border-box',
                }}
              >
                <GridLayoutPlot
                  data={plotData}
                  colWidth={colWidth}
                  rowHeight={rowHeight}
                />
              </Paper>
            );
          })}
        </GridLayout>
      </ScrollArea>
    </>
  ) : (
    <Stack h="100%" align="center" w="100%" justify="center">
      <Text>No chart generates</Text>
    </Stack>
  );
};
