import { useEffect, useState } from 'react';
import { DataGridPlot, synchronizedList } from '../../../types';
import { MultiSelect, Stack } from '@mantine/core';
import { useIbexStore } from '../../../stores';
import { getColorRandom } from '../../../utils';

interface CustomizeSynchronizationProps {
  customizedDataGrid: DataGridPlot;
  setCustomizedDataGrid: React.Dispatch<React.SetStateAction<DataGridPlot>>;
}
export const CustomizeSynchronization = ({
  customizedDataGrid,
  setCustomizedDataGrid,
}: CustomizeSynchronizationProps) => {
  const { active } = useIbexStore();
  const [synchronizedList, setSynchronizedList] = useState<synchronizedList>(
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

    if (newSynchronizedList.length < synchronizedList.list.length) {
      // Remove an element
      setSynchronizedList({
        color: !newSynchronizedList.length ? '' : synchronizedList.color,
        list: newSynchronizedList,
      });
    } else {
      // Add an element
      if (newDepencyAdded?.synchronizedGrids.list.length) {
        // Add also these dependencies
        setSynchronizedList({
          color: newDepencyAdded.synchronizedGrids.color,
          list: Array.from(
            new Set([
              ...newSynchronizedList,
              ...newDepencyAdded.synchronizedGrids.list.filter(
                (dataGridId) => dataGridId !== customizedDataGrid.i,
              ),
            ]),
          ),
        });
      } else {
        setSynchronizedList({
          color: !synchronizedList.list.length
            ? getColorRandom()
            : synchronizedList.color,
          list: newSynchronizedList,
        });
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
        value={synchronizedList.list}
        onChange={handleSynchronizedListUpdate}
        searchable
        nothingFoundMessage="Nothing found..."
      />
    </Stack>
  );
};
