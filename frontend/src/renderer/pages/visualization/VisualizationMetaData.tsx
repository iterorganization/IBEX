import {
  Accordion,
  AccordionControl,
  Container,
  Grid,
  ScrollArea,
  Spoiler,
  Stack,
  Table,
  Tabs,
  Title,
} from '@mantine/core';
import { useIbexStore } from '../../stores';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SimplePlotly, TabsListCustom } from '../../components';
import {
  ArraySummaryResponse,
  Configuration,
  DataGridPlot,
  DataPlotly,
  PlotCoordinatesResponse,
  Axis,
  PlotDataResponse,
} from 'src/renderer/types';
import { fetchArraySummary, fetchDataPlot } from '../../utils';

interface MetaDataInfosProps {
  gridLayoutKey: string;
  data: DataPlotly;
  yAxis: Axis;
  tabsSelected: string | null;
  height?: string;
}

interface RenderMetaDataCoordinatesProps {
  coordinates: PlotCoordinatesResponse[];
}

const renderField = (label: string, value?: string | number) => (
  <Table.Tr>
    <Table.Td
      fw="bold"
      styles={{
        td: {
          wordBreak: 'break-all',
        },
      }}
    >
      {label}
    </Table.Td>
    <Table.Td>{value ? value : 'N/A'}</Table.Td>
  </Table.Tr>
);

const renderSpoiler = (
  label: string,
  value?: string | number | (string | number)[],
) => (
  <Table.Tr>
    <Table.Td fw="bold">{label}</Table.Td>
    <Table.Td>
      {value === undefined || value === null ? (
        'N/A'
      ) : Array.isArray(value) ? (
        value.length === 0 ? (
          'N/A'
        ) : (
          <ScrollArea h={value.length > 5 ? 150 : 'auto'}>
            <Spoiler
              maxHeight={value.length > 5 ? 150 : 50}
              showLabel="Show more"
              hideLabel="Hide"
            >
              <Stack align="flex-start" gap={1}>
                {value.map((v, i) => (
                  <div key={i}>
                    {v}
                    {value.length - 1 !== i ? ',' : ''}
                  </div>
                ))}
              </Stack>
            </Spoiler>
          </ScrollArea>
        )
      ) : String(value).trim() === '' ? (
        'N/A'
      ) : (
        value
      )}
    </Table.Td>
  </Table.Tr>
);

const RenderMetaDataCoordinates = ({
  coordinates,
}: RenderMetaDataCoordinatesProps) => {
  const renderCoordinates = (coordinate: PlotCoordinatesResponse) => (
    <Table
      withRowBorders={false}
      styles={{
        td: {
          wordBreak: 'keep-all',
        },
      }}
    >
      <Table.Tbody>
        {renderField('name', coordinate.name)}
        {renderField('path', coordinate.path)}
        {renderField('unit', coordinate.unit)}
        {renderSpoiler('shape', coordinate.shape as number[])}
        {renderField('ndim', coordinate.ndim.toString())}

        {renderSpoiler('value', coordinate.value as number[])}

        {renderField('description', coordinate.description)}
        {renderField('target', coordinate.target)}
      </Table.Tbody>
    </Table>
  );

  return (
    <Table.Tr>
      <Table.Td fw="bold">Coordinates</Table.Td>
      <Table.Td>
        {coordinates.length === 0 ? (
          'N/A'
        ) : (
          <Accordion chevronPosition="left" variant="filled">
            {coordinates.map((coordinate, index) => (
              <Accordion.Item key={index} value={coordinate.name}>
                <AccordionControl>{coordinate.name}</AccordionControl>
                <Accordion.Panel>
                  {renderCoordinates(coordinate)}
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>
        )}
      </Table.Td>
    </Table.Tr>
  );
};

export const MetaDataInfos = ({
  gridLayoutKey,
  data,
  yAxis,
  height,
  tabsSelected,
}: MetaDataInfosProps) => {
  const { active } = useIbexStore();
  const [coordinates, setCoordinates] = useState<PlotCoordinatesResponse[]>([]);
  const [summary, setSummary] = useState<ArraySummaryResponse>(null);

  useEffect(() => {
    const fetchCoordinates = async () => {
      try {
        if (tabsSelected === data.name) {
          // Force with downsampled method if selected by user
          const downsampled_method = active.dataPlot.find(
            (gridLayout) => gridLayout.i === gridLayoutKey,
          )?.downsampled_method;

          const response: PlotDataResponse = await fetchDataPlot(
            data.nodeUri,
            downsampled_method,
          );

          setCoordinates(response.data.coordinates);
        }
      } catch (error) {
        console.error('Error fetching coordinates:', error);
      }
    };

    fetchCoordinates();
  }, [data.nodeUri, tabsSelected]);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        if (tabsSelected === data.name) {
          const response: ArraySummaryResponse = await fetchArraySummary(
            data.nodeUri,
          );
          setSummary(response);
        }
      } catch (error) {
        console.error('Error fetching array summary:', error);
      }
    };

    fetchSummary();
  }, [tabsSelected]);

  return (
    <Stack gap={0}>
      <Title ta={'center'} order={3} pt={10}>
        Metadatas
      </Title>
      <ScrollArea h={height || '79vh'}>
        <Table py="md">
          <Table.Tbody>
            {renderField('uri', data?.nodeUri)}
            {renderField('name', data?.name)}
            {renderField('path', data?.path)}
            {renderField('unit', yAxis.unit)}
            {renderSpoiler('shape', data.shape as (string | number)[])}
            {renderField('dimension', data?.dimensions.toString())}
            {renderSpoiler(
              'value',
              data.y.length
                ? data.y
                : (data.yData as string | number | (string | number)[]),
            )}
            {renderField('min', summary?.min)}
            {renderField('max', summary?.max)}
            {renderField('mean', summary?.mean)}
            {renderField('standard_deviation', summary?.standard_deviation)}
            {renderField('description', data?.description)}
            <RenderMetaDataCoordinates coordinates={coordinates} />
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </Stack>
  );
};

export const VisualizationMetaData = () => {
  const HEIGHT = '79vh';
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const WIDTH_PLOT = Math.floor(containerWidth * (5 / 12));
  const HEIGHT_PLOT = 390;
  const { active, updatedConfiguration } = useIbexStore();
  const [tabsValue, setTabsValue] = useState<string | null>();
  const [itemDataGrid, setItemDataGrid] = useState<DataGridPlot | null>(null);
  const [dataGridLayout, setDataGridLayout] = useState<DataGridPlot | null>(
    null,
  );

  /**
   * Handle find grid layout corresponding to the selected tab
   */
  useEffect(() => {
    if (active?.metadataGridLayout) {
      const data = active.dataPlot.find(
        (item: DataGridPlot) => item.i === active.metadataGridLayout,
      );
      if (data) {
        setDataGridLayout(data);
        setTabsValue(data.plot[0]?.name || null);
        const findPlot = data.plot.find(
          (item) => item.name === data.plot[0]?.name,
        );
        if (findPlot) {
          setItemDataGrid({
            ...data,
            plot: [findPlot],
          });
        }
      }
    }
  }, [active]);

  /**
   * Handle the resizing of the width
   */
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [tabsValue]);

  /**
   * Handle the switch grid event
   */
  const closeWithoutSaving = useCallback(() => {
    const updatedActive: Configuration = {
      ...active,
      metadataGridLayout: null,
    };
    updatedConfiguration(updatedActive);
  }, [active]);

  /**
   * Handle selected tab change
   */
  const handleSelectedTab = useCallback(
    (value: string | null) => {
      setTabsValue(value);
      if (dataGridLayout) {
        const selectedPlot = dataGridLayout.plot.find(
          (item) => item.name === value,
        );
        if (selectedPlot) {
          setItemDataGrid({
            ...dataGridLayout,
            plot: [selectedPlot],
          });
        }
      }
    },
    [dataGridLayout, setItemDataGrid],
  );

  return (
    <Container fluid pb={10}>
      <Tabs value={tabsValue} onChange={(value) => handleSelectedTab(value)}>
        <TabsListCustom
          data={
            dataGridLayout
              ? dataGridLayout.plot
                  .map((item) => item?.name || '')
                  .filter((item) => item)
              : []
          }
          value={tabsValue}
          usedFor="metadatas"
          closeWithoutSaving={closeWithoutSaving}
        />

        {dataGridLayout &&
          dataGridLayout.plot.map((item: DataPlotly, index) => {
            // force to have only one axis in metadata plot
            const itemWithoutY2axis = JSON.parse(JSON.stringify(item));
            if (item.yaxis != '') {
              delete itemWithoutY2axis.yaxis;
            }

            return (
              item?.name && (
                <Tabs.Panel key={index} value={item.name}>
                  {tabsValue === item.name && (
                    <Grid type="container" ref={containerRef}>
                      <Grid.Col span={5}>
                        <SimplePlotly
                          itemDataGrid={itemDataGrid}
                          width={WIDTH_PLOT}
                          height={HEIGHT_PLOT}
                          showSliders={false}
                        />
                      </Grid.Col>
                      <Grid.Col span={7}>
                        <MetaDataInfos
                          gridLayoutKey={dataGridLayout.i}
                          data={item}
                          yAxis={
                            item.yaxis !== ''
                              ? dataGridLayout.y2AxisData
                              : dataGridLayout.yAxisData
                          }
                          height={HEIGHT}
                          tabsSelected={tabsValue}
                        />
                      </Grid.Col>
                    </Grid>
                  )}
                </Tabs.Panel>
              )
            );
          })}
      </Tabs>
    </Container>
  );
};
