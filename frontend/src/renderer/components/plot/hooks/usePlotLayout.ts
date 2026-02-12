import { useEffect } from 'react';
import { AxisType } from 'plotly.js';
import { DataGridPlot } from 'src/renderer/types';
import { Layout } from 'plotly.js';

interface UsePlotLayoutParams {
  itemDataGrid: DataGridPlot;
  setLayoutPlot: (value: React.SetStateAction<Partial<Layout>>) => void;
}

export function usePlotLayout({
  itemDataGrid,
  setLayoutPlot,
}: UsePlotLayoutParams) {
  // Grid
  useEffect(() => {
    setLayoutPlot((prevLayout) => ({
      ...prevLayout,
      xaxis: {
        ...prevLayout.xaxis,
        showgrid: itemDataGrid.displayGrid,
      },
      yaxis: {
        ...prevLayout.yaxis,
        showgrid: itemDataGrid.displayGrid,
      },
    }));
  }, [itemDataGrid.displayGrid, setLayoutPlot]);

  // X axis
  useEffect(() => {
    setLayoutPlot((prevLayout) => ({
      ...prevLayout,
      xaxis: {
        ...prevLayout.xaxis,
        type:
          (itemDataGrid?.xAxisData?.type as AxisType) || prevLayout.xaxis?.type,
      },
    }));
  }, [itemDataGrid.xAxisData?.type, setLayoutPlot]);

  // Y axis
  useEffect(() => {
    setLayoutPlot((prevLayout) => ({
      ...prevLayout,
      yaxis: {
        ...prevLayout.yaxis,
        type:
          (itemDataGrid?.yAxisData?.type as AxisType) || prevLayout.yaxis?.type,
      },
    }));
  }, [itemDataGrid.yAxisData?.type, setLayoutPlot]);

  // Y2 axis
  useEffect(() => {
    setLayoutPlot((prevLayout) => ({
      ...prevLayout,
      yaxis2: {
        ...prevLayout.yaxis2,
        type:
          (itemDataGrid?.y2AxisData?.type as AxisType) ||
          prevLayout.yaxis2?.type,
      },
    }));
  }, [itemDataGrid.y2AxisData?.type, setLayoutPlot]);

  useEffect(() => {
    const newTypeOfX = typeof itemDataGrid.plot[0].x[0];
    if (newTypeOfX === 'string') {
      // Update x axis to category type if it become a string
      setLayoutPlot((prevLayout) => ({
        ...prevLayout,
        xaxis: { ...prevLayout.xaxis, type: 'category' },
      }));
      itemDataGrid.xAxisData.type = 'category';
    } else if (
      itemDataGrid.xAxisData?.type === 'category' &&
      newTypeOfX === 'number'
    ) {
      // Update x axis to linear type if it become a number
      setLayoutPlot((prevLayout) => ({
        ...prevLayout,
        xaxis: { ...prevLayout.xaxis, type: 'linear' },
      }));
      itemDataGrid.xAxisData.type = 'linear';
    }
  }, [itemDataGrid.xAxisData.name]);
}
