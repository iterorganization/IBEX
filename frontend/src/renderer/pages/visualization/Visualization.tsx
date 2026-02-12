import { Center, Container, Paper, Text } from '@mantine/core';
import { useIbexStore } from '../../stores';
import { VisualizationTree } from './VisualizationTree';
import { VisualizationPlot } from './VisualizationPlot';
import { VisualizationMetaData } from './VisualizationMetaData';
import { DataplotCustomization } from './DataplotCustomization';
import { useDisclosure } from '@mantine/hooks';

export const Visualization = () => {
  const { active, configurations } = useIbexStore();
  const [opened, { toggle }] = useDisclosure(true);

  const HEIGHT = '88.5vh';

  const leftWidth = opened ? '16.666%' : '3%'; // span=2 or 1 on 12
  const rightWidth = opened ? '83.333%' : '97%'; // span=10 or 11 on 12

  return (
    <Container fluid p={10} data-testid="visualization-container">
      {configurations.length > 0 ? (
        <div style={{ display: 'flex', transition: 'width 0.3s ease' }}>
          <div
            style={{
              width: leftWidth,
              transition: 'width 0.3s ease',
              marginRight: '10px',
            }}
            data-testid="visualization-left-panel"
          >
            <Paper shadow="md" h={HEIGHT} radius="md" pt="sm">
              <VisualizationTree
                height={HEIGHT}
                extended={opened}
                handleExtended={toggle}
                data-testid="visualization-tree"
              />
            </Paper>
          </div>

          <div
            style={{
              width: rightWidth,
              transition: 'width 0.3s ease',
            }}
            data-testid="visualization-right-panel"
          >
            <Paper shadow="md" h={HEIGHT} radius="md">
              {active?.metadataGridLayout ? (
                <VisualizationMetaData data-testid="visualization-metadata" />
              ) : active?.customizedGridLayout ? (
                <DataplotCustomization />
              ) : (
                <VisualizationPlot
                  extended={!opened}
                  height={HEIGHT}
                  data-testid="visualization-plot"
                />
              )}
            </Paper>
          </div>
        </div>
      ) : (
        <Center h={HEIGHT}>
          <Text>No configurations available</Text>
        </Center>
      )}
    </Container>
  );
};
