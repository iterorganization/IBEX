import { useEffect, useState } from 'react';
import { DataGridPlot } from '../../../types';
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
  const { active } = useIbexStore();
  const [synchronizedList, setSynchronizedList] = useState<string[]>(
    customizedDataGrid?.synchronizedGrids,
  );
  const fullDataGridList: { value: string; label: string }[] = active.dataPlot
    .filter((dataGrid) => dataGrid.i !== customizedDataGrid.i)
    .map((dataGrid) => ({ value: dataGrid.i, label: dataGrid.title }));

  useEffect(() => {
    setCustomizedDataGrid({
      ...customizedDataGrid,
      synchronizedGrids: synchronizedList,
    });
  }, [synchronizedList]);

  const handleSynchronizedListUpdate = (newSynchronizedList: string[]) => {
    const newDepencyAdded = active.dataPlot.find(
      (dp) => dp.i === newSynchronizedList[newSynchronizedList.length - 1],
    );

    if (newSynchronizedList.length < synchronizedList.length) {
      // Remove an element
      setSynchronizedList(newSynchronizedList);
    } else {
      // Add an element
      if (newDepencyAdded?.synchronizedGrids.length) {
        // Add also these dependencies
        setSynchronizedList(
          Array.from(
            new Set([
              ...newSynchronizedList,
              ...newDepencyAdded.synchronizedGrids,
            ]),
          ),
        );
      } else {
        setSynchronizedList(newSynchronizedList);
      }
    }
  };

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
        onChange={handleSynchronizedListUpdate}
        searchable
        nothingFoundMessage="Nothing found..."
      />
    </Stack>
  );
};
