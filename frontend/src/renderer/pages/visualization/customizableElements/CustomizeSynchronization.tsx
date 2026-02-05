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
import { MultiSelect, Stack } from '@mantine/core';
import { useIbexStore } from '../../../stores';

interface CustomizeSynchronizationProps {
  customizedDataGrid: DataGridPlot;
  setCustomizedDataGrid: React.Dispatch<React.SetStateAction<DataGridPlot>>;
}
export const CustomizeSynchronization = ({
  customizedDataGrid,
  setCustomizedDataGrid,
}: CustomizeSynchronizationProps) => {
  const { active, updatedConfiguration } = useIbexStore();
  const [synchronizedList, setSynchronizedList] = useState<string[]>([]);
  const fullDataGridList: { value: string; label: string }[] = active.dataPlot
    .filter((dataGrid) => dataGrid.i !== customizedDataGrid.i)
    .map((dataGrid) => ({ value: dataGrid.i, label: dataGrid.title }));

  /*
   * Get downsampling methods to show in select
   */
  useEffect(() => {
    console.log('active : ', active);
    console.log('customizedDataGrid : ', customizedDataGrid);
    console.log('fullDataGridList : ', fullDataGridList);
  }, []);

  useEffect(() => {
    console.log('synchronizedList : ', synchronizedList);
    // TODO : MAJ customizedDataGrid.synchronizedGrids here
    // setCustomizedDataGrid({
    //   ...customizedDataGrid,
    //   synchronizedGrids: synchronizedList
    // });

    console.log('active : ', active);

    const updatedActive = JSON.parse(JSON.stringify(active));
    for (const [index, dataPlot] of updatedActive.dataPlot.entries()) {
      if (dataPlot.i === customizedDataGrid.i) {
        // Add in customized grid the synchronized list
        updatedActive.dataPlot[index].synchronizedGrids = synchronizedList;
      } else if (synchronizedList.includes(dataPlot.i)) {
        // Add in other grid the synchronized list and include the customized grid
        updatedActive.dataPlot[index].synchronizedGrids = [
          customizedDataGrid.i,
          ...synchronizedList.filter((i) => i !== dataPlot.i),
        ];
      }
    }
    updatedConfiguration(updatedActive);
    console.log('updatedActive (SYNC) : ', updatedActive);
  }, [synchronizedList]);

  return (
    <Stack w="fit-content">
      <MultiSelect
        w={300}
        maxDropdownHeight={200}
        label="Graphs to synchronyze"
        placeholder="Pick a graph"
        data={fullDataGridList}
        // defaultValue={['React']}
        value={synchronizedList}
        onChange={setSynchronizedList}
        searchable
        nothingFoundMessage="Nothing found..."
      />
    </Stack>
  );
};
