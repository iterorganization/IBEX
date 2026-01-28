import { Group, Select, Stack, Switch, TextInput } from '@mantine/core';
import { DataGridPlot } from '../../../types';

interface CustomizeGlobalProps {
  customizedDataGrid: DataGridPlot;
  setCustomizedDataGrid: React.Dispatch<React.SetStateAction<DataGridPlot>>;
}
export const CustomizeGlobal = ({
  customizedDataGrid,
  setCustomizedDataGrid,
}: CustomizeGlobalProps) => {
  const typeOfXData = typeof customizedDataGrid.plot[0].x[0] as
    | 'string'
    | 'number';
  const typeOfYData = typeof customizedDataGrid.plot[0].y[0] as
    | 'string'
    | 'number';
  const typeOfY2Data = typeof customizedDataGrid.plot.find(
    (p) => p.yaxis === 'y2',
  )?.y[0] as 'string' | 'number';

  const checkTypesToDisable = (
    typeOfData: 'string' | 'number',
    selectableType: 'category' | 'linear' | 'log',
  ) => {
    if (typeOfData === 'string') {
      return selectableType === 'category' ? false : true;
    } else {
      return selectableType !== 'category' ? false : true;
    }
  };

  const getSelectableData = (typeOfAxisData: 'string' | 'number') => {
    return [
      {
        value: 'category',
        label: 'category',
        disabled: checkTypesToDisable(typeOfAxisData, 'category'),
      },
      {
        value: 'linear',
        label: 'linear',
        disabled: checkTypesToDisable(typeOfAxisData, 'linear'),
      },
      {
        value: 'log',
        label: 'log',
        disabled: checkTypesToDisable(typeOfAxisData, 'log'),
      },
    ];
  };
  return (
    <Stack>
      <TextInput
        label="Title"
        description="Customize the title"
        placeholder="Enter the title"
        value={customizedDataGrid?.title || ''}
        onChange={(form) =>
          setCustomizedDataGrid({
            ...customizedDataGrid,
            title: form.currentTarget.value,
          })
        }
      />

      <Group>
        <Select
          label="Type of x axis"
          description="Customize the type of x axis"
          placeholder="Customize the type of x axis"
          data={getSelectableData(typeOfXData)}
          value={
            customizedDataGrid?.xAxisData?.type ||
            getSelectableData(typeOfXData).find((el) => el.disabled === false)
              .value
          }
          onChange={(value) =>
            value &&
            setCustomizedDataGrid({
              ...customizedDataGrid,
              xAxisData: { ...customizedDataGrid.xAxisData, type: value },
            })
          }
          maw={200}
        />
        <Select
          label="Type of y axis"
          description="Customize the type of y axis"
          placeholder="Customize the type of y axis"
          data={getSelectableData(typeOfYData)}
          value={
            customizedDataGrid?.yAxisData?.type ||
            getSelectableData(typeOfYData).find((el) => el.disabled === false)
              .value
          }
          onChange={(value) =>
            value &&
            setCustomizedDataGrid({
              ...customizedDataGrid,
              yAxisData: { ...customizedDataGrid.yAxisData, type: value },
            })
          }
          maw={200}
        />
        {customizedDataGrid?.y2AxisData && (
          <Select
            label="Type of y2 axis"
            description="Customize the type of y2 axis"
            placeholder="Customize the type of y2 axis"
            data={getSelectableData(typeOfY2Data)}
            value={
              customizedDataGrid?.y2AxisData?.type ||
              getSelectableData(typeOfY2Data).find(
                (el) => el.disabled === false,
              ).value
            }
            onChange={(value) =>
              value &&
              setCustomizedDataGrid({
                ...customizedDataGrid,
                y2AxisData: { ...customizedDataGrid.y2AxisData, type: value },
              })
            }
            maw={200}
          />
        )}
      </Group>

      <Switch
        label="Display the grid"
        checked={customizedDataGrid.displayGrid}
        onChange={(event) =>
          setCustomizedDataGrid({
            ...customizedDataGrid,
            displayGrid: event.currentTarget.checked,
          })
        }
      />
    </Stack>
  );
};
