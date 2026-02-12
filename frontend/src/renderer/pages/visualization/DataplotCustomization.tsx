import {
  Accordion,
  ActionIcon,
  Container,
  Grid,
  ScrollArea,
  Stack,
  Tabs,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { useIbexStore } from '../../stores';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SimplePlotly, Heatmap2D, TabsListCustom } from '../../components';
import {
  Configuration,
  DataGridPlot,
  DataPlotly,
  PlotLine,
} from 'src/renderer/types';
import { CustomizeDownsampling, CustomizeGlobal } from './customizableElements';
import { CustomizeHeatmap } from './customizableElements/CustomizeHeatmap';
import { Customize1DPlot } from './customizableElements/Customize1DPlot';
import { CustomizeDataRange } from './customizableElements/CustomizeDataRange';
interface CustomizationProps {
  customizedDataGrid: DataGridPlot;
  selectedAccordion: string | null;
  selectedPlot: DataPlotly | null;
  applyToAllHeatmap: boolean;
  setCustomizedDataGrid: React.Dispatch<React.SetStateAction<DataGridPlot>>;
  setSelectedAccordion: React.Dispatch<React.SetStateAction<string | null>>;
  setApplyToAllHeatmap: React.Dispatch<React.SetStateAction<boolean>>;
  initPlotColors: () => void;
}
const Customization = ({
  customizedDataGrid,
  selectedAccordion,
  selectedPlot,
  applyToAllHeatmap,
  setCustomizedDataGrid,
  setSelectedAccordion,
  setApplyToAllHeatmap,
  initPlotColors,
}: CustomizationProps) => {
  type accordionItemsType = {
    value: string;
    component: JSX.Element;
    icon?: JSX.Element;
    disabled?: boolean;
    tooltip?: string;
  };
  const accordionItems: accordionItemsType[] = [
    {
      value: 'Global',
      component: (
        <CustomizeGlobal
          customizedDataGrid={customizedDataGrid}
          setCustomizedDataGrid={setCustomizedDataGrid}
        />
      ),
    },
    {
      value: '1D plots',
      component: (
        <Customize1DPlot
          customizedDataGrid={customizedDataGrid}
          selectedPlot={selectedPlot}
          setCustomizedDataGrid={setCustomizedDataGrid}
          initPlotColors={initPlotColors}
        />
      ),
      icon: (
        <ActionIcon variant="filled" component="span">
          <Text fw="bold">1D</Text>
        </ActionIcon>
      ),
    },
    {
      value: 'Heatmap',
      component: (
        <CustomizeHeatmap
          customizedDataGrid={customizedDataGrid}
          selectedPlot={selectedPlot}
          applyToAllHeatmap={applyToAllHeatmap}
          setCustomizedDataGrid={setCustomizedDataGrid}
          setApplyToAllHeatmap={setApplyToAllHeatmap}
        />
      ),
      icon: (
        <ActionIcon
          variant="filled"
          component="span"
          disabled={customizedDataGrid.coordinates.length < 2}
        >
          <svg width="50" height="50" viewBox="0 0 50 50">
            <rect x="0" y="0" width="15" height="15" fill="#440154" />
            <rect x="17" y="0" width="15" height="15" fill="#31688e" />
            <rect x="34" y="0" width="15" height="15" fill="#35b779" />

            <rect x="0" y="17" width="15" height="15" fill="#fde725" />
            <rect x="17" y="17" width="15" height="15" fill="#440154" />
            <rect x="34" y="17" width="15" height="15" fill="#31688e" />

            <rect x="0" y="34" width="15" height="15" fill="#35b779" />
            <rect x="17" y="34" width="15" height="15" fill="#fde725" />
            <rect x="34" y="34" width="15" height="15" fill="#440154" />
          </svg>
        </ActionIcon>
      ),
      disabled: customizedDataGrid.coordinates.length < 2,
      tooltip: "This grid can't display heatmap",
    },
    {
      value: 'Axis range',
      component: (
        <CustomizeDataRange
          customizedDataGrid={customizedDataGrid}
          setCustomizedDataGrid={setCustomizedDataGrid}
        />
      ),
    },
    {
      value: 'Downsampling',
      component: (
        <CustomizeDownsampling
          customizedDataGrid={customizedDataGrid}
          setCustomizedDataGrid={setCustomizedDataGrid}
        />
      ),
    },
    {
      value: 'Dataplots synchronization',
      component: <></>,
      disabled: true,
    },
  ];

  const items = accordionItems.map((item) => (
    <Tooltip
      key={item.value}
      label={
        item?.disabled
          ? item?.tooltip || 'This feature will be available soon'
          : ''
      }
      position="bottom-start"
      opened={item?.disabled ? null : false}
    >
      <Accordion.Item value={item.value}>
        <Accordion.Control icon={item.icon} disabled={item?.disabled || false}>
          {item.value}
        </Accordion.Control>
        <Accordion.Panel>{item.component}</Accordion.Panel>
      </Accordion.Item>
    </Tooltip>
  ));

  return (
    <Stack gap={0}>
      <Title ta={'center'} order={3} pt={10}>
        Customize plot parameters
      </Title>
      <ScrollArea h="79vh">
        <Accordion value={selectedAccordion} onChange={setSelectedAccordion}>
          {items}
        </Accordion>
      </ScrollArea>
    </Stack>
  );
};

export const DataplotCustomization = () => {
  const customContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const WIDTH_PLOT = Math.floor(containerWidth * (6 / 12));
  const HEIGHT_PLOT = 390;
  const { active, updatedConfiguration } = useIbexStore();
  const [tabsValue, setTabsValue] = useState<string | null>();
  const [customizedDataGrid, setCustomizedDataGrid] =
    useState<DataGridPlot | null>(null);
  const [dataGridLayout, setDataGridLayout] = useState<DataGridPlot | null>(
    null,
  );
  const [selectedAccordion, setSelectedAccordion] = useState<string | null>(
    null,
  );
  const [selectedPlot, setSelectedPlot] = useState<DataPlotly | null>(null);
  const [applyToAllHeatmap, setApplyToAllHeatmap] = useState(true);

  useEffect(() => {
    if (customizedDataGrid) {
      // Update dataGridLayout when customizedDataGrid changes
      const updatedDataGridLayout = {
        ...dataGridLayout,
        title: customizedDataGrid?.title,
        downsampled_method: customizedDataGrid?.downsampled_method,
        plot: customizedDataGrid?.plot,
      } as DataGridPlot;
      setDataGridLayout(updatedDataGridLayout);
      setSelectedPlot(
        updatedDataGridLayout.plot.find((data) => data.name === tabsValue),
      );
    }
  }, [customizedDataGrid]);

  /**
   * Handle find grid layout corresponding to the selected tab
   */
  useEffect(() => {
    if (active?.customizedGridLayout) {
      const data = JSON.parse(
        JSON.stringify(
          active.dataPlot.find(
            (item: DataGridPlot) => item.i === active.customizedGridLayout,
          ),
        ),
      );
      if (data) {
        setDataGridLayout(data);
        setCustomizedDataGrid(data);
        setTabsValue(data.plot[0]?.name || null);
      }
    }
  }, []);

  /**
   * Init plots color by adding color in plot.line for each plot
   */
  const initPlotColors = () => {
    // Get plot colors when select 1D plots accordion
    const customContainer = customContainerRef.current;
    if (!customContainer) return;
    // Get child elements from the legend
    const legends = customContainer.querySelectorAll<SVGGElement>('g.layers');

    const updatedPlotColors = JSON.parse(
      JSON.stringify(customizedDataGrid),
    ) as DataGridPlot;
    if (legends?.length) {
      // When we have a color legend (so several plots)
      let plotIndex = 0;
      let shouldUpdateColors = false;
      for (const plot of updatedPlotColors.plot) {
        // Get from DOM & set color in plot.line for each plots
        if (!plot?.line?.color) {
          shouldUpdateColors = true;
        }

        const line = legends[plotIndex].querySelector<SVGGElement>(
          'g.legendlines > path',
        );
        // We get color from point when plot.mode === "markers"
        const point = legends[plotIndex].querySelector<SVGGElement>(
          'g.legendpoints > path',
        );
        const colorFromDOM = line?.style?.stroke || point?.style?.fill;

        if (!plot?.line) {
          plot.line = { color: colorFromDOM } as PlotLine;
        } else {
          plot.line.color = colorFromDOM;
        }
        plotIndex++;
      }
      if (!shouldUpdateColors) {
        return;
      }
    } else if (updatedPlotColors.plot.length === 1) {
      // When we have only one plot, thee is no legend so we set manualy to the first plotly color
      updatedPlotColors.plot[0].line = {
        color: 'rgb(31, 119, 180)',
      } as PlotLine;
    }
    setCustomizedDataGrid(updatedPlotColors);
  };

  useEffect(() => {
    initPlotColors();
  }, [customContainerRef.current]);

  /**
   * Handle the resizing of the width
   */
  useEffect(() => {
    if (!customContainerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    observer.observe(customContainerRef.current);
    return () => observer.disconnect();
  }, [tabsValue]);

  /**
   * Handle close of customization
   */
  const closeWithoutSaving = useCallback(() => {
    const updatedActive: Configuration = JSON.parse(
      JSON.stringify(active),
    ) as Configuration;
    updatedActive.customizedGridLayout = null;
    updatedConfiguration(updatedActive);
  }, [active]);

  /**
   * Handle save & close of customization
   */
  const saveAndClose = useCallback(() => {
    const updatedActive: Configuration = {
      ...active,
      customizedGridLayout: null,
      saved: false,
    };
    const updatedDataPlot: DataGridPlot[] = [
      ...updatedActive.dataPlot.filter(
        (dp) => dp.i !== active.customizedGridLayout,
      ),
      customizedDataGrid,
    ];

    updatedConfiguration({ ...updatedActive, dataPlot: updatedDataPlot });
  }, [active, customizedDataGrid]);

  /**
   * Handle selected tab change
   */
  const handleSelectedTab = useCallback(
    (value: string | null) => {
      setTabsValue(value);
      if (dataGridLayout) {
        const plotTab = dataGridLayout.plot.find((item) => item.name === value);
        if (plotTab) {
          setSelectedPlot(plotTab);
        }
      }
    },
    [dataGridLayout, setCustomizedDataGrid],
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
          usedFor="personalization"
          closeWithoutSaving={closeWithoutSaving}
          saveAndClose={saveAndClose}
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
                    <Grid type="container" ref={customContainerRef}>
                      <Grid.Col span={6}>
                        {selectedAccordion === 'Heatmap' ? (
                          <Heatmap2D
                            itemDataGrid={customizedDataGrid}
                            width={WIDTH_PLOT}
                            height={HEIGHT_PLOT}
                            plotIndex={customizedDataGrid.plot
                              .findIndex((data) => data.name === item.name)
                              .toString()}
                            showSliders={false}
                          />
                        ) : (
                          <SimplePlotly
                            itemDataGrid={customizedDataGrid}
                            width={WIDTH_PLOT}
                            height={HEIGHT_PLOT}
                            showSliders={false}
                          />
                        )}
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <Customization
                          customizedDataGrid={customizedDataGrid}
                          selectedAccordion={selectedAccordion}
                          selectedPlot={selectedPlot}
                          applyToAllHeatmap={applyToAllHeatmap}
                          setCustomizedDataGrid={setCustomizedDataGrid}
                          setSelectedAccordion={setSelectedAccordion}
                          setApplyToAllHeatmap={setApplyToAllHeatmap}
                          initPlotColors={initPlotColors}
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
