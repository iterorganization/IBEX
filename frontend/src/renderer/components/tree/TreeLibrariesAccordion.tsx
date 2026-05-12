import {
  Accordion,
  ColorSwatch,
  Group,
  ScrollArea,
  SimpleGrid,
  Text,
  Tooltip,
} from '@mantine/core';
import { CustomTreeData, URITreeNodeData } from 'src/renderer/types';
import { TreeLibrary } from '../../components';
import { useIbexStore } from '../../stores';
import { useEffect, useMemo, useRef, useState } from 'react';

interface VisualizationTreeProps {
  customDataTree: CustomTreeData[];
  height: string;
  checkedNodes: URITreeNodeData[];
  value?: string;
  handleAccordionChange(value: string): Promise<void>;
  handleSelectChildren: (nodeUri: string) => Promise<void>;
  getNodesChecked: (nodes: URITreeNodeData[]) => void;
  getCurrentSelectedURI: () => string;
}

interface AccordionLabelProps {
  label: string;
  description: string;
  color: string;
}

function AccordionLabel({ label, description, color }: AccordionLabelProps) {
  return (
    <Group wrap="nowrap">
      <ColorSwatch color={color} />
      <SimpleGrid cols={1} verticalSpacing={0}>
        <Text>{label}</Text>
        <Tooltip label={description} position="right">
          <Text
            size="sm"
            c="dimmed"
            fw={400}
            styles={{
              root: {
                whiteSpace: 'nowrap',
              },
            }}
          >
            {description}
          </Text>
        </Tooltip>
      </SimpleGrid>
    </Group>
  );
}

export const TreeLibrariesAccordion = ({
  customDataTree,
  height,
  checkedNodes,
  value,
  handleAccordionChange,
  handleSelectChildren,
  getNodesChecked,
  getCurrentSelectedURI,
}: VisualizationTreeProps) => {
  const { active } = useIbexStore();
  const [editedDataPlot, setEditedDataPlot] = useState(
    active?.dataPlot?.find((p) => p.isEditing),
  );
  const metadataGridLayout = useIbexStore(
    (state) => state.active?.metadataGridLayout,
  );
  const customizedGridLayout = useIbexStore(
    (state) => state.active?.customizedGridLayout,
  );
  const stableMetadataGridLayout = useMemo(
    () => metadataGridLayout,
    [JSON.stringify(metadataGridLayout)],
  );
  const stableCustomizedGridLayout = useMemo(
    () => customizedGridLayout,
    [JSON.stringify(customizedGridLayout)],
  );
  const previousEditedIdRef = useRef<string | null>(null);

  useEffect(() => {
    setEditedDataPlot(active?.dataPlot?.find((p) => p.isEditing));
  }, [active.dataPlot]);

  useEffect(() => {
    const openAccordionToAccessNodes = async () => {
      if (editedDataPlot?.plot.length) {
        const plotUriSplit = editedDataPlot.plot[0].nodeUri.split('#');
        const firstUri = plotUriSplit[0];
        if (!value) {
          await handleAccordionChange(firstUri);
        }
      } else {
        previousEditedIdRef.current = null;
      }
    };

    openAccordionToAccessNodes();
  }, [editedDataPlot]);

  const items = customDataTree.map((item) => {
    return (
      <Accordion.Item
        data-testid={`uriAccordion-${item.uri}`}
        key={`accodion-${item.uri}`}
        value={`${item.uri}`}
      >
        <Accordion.Control style={{ userSelect: 'text' }}>
          <AccordionLabel
            label={item.name}
            description={item.uri}
            color={item?.uriColor}
          />
        </Accordion.Control>
        <Accordion.Panel>
          <TreeLibrary
            treeData={item.data}
            editedDataPlot={editedDataPlot}
            checkedNodes={checkedNodes}
            metadataGridLayout={stableMetadataGridLayout}
            customizedGridLayout={stableCustomizedGridLayout}
            previousEditedIdRef={previousEditedIdRef}
            handleSelectChildren={handleSelectChildren}
            getCheckedNodes={getNodesChecked}
            expendAll={item.expendAll}
            getCurrentSelectedURI={getCurrentSelectedURI}
            handleAccordionChange={handleAccordionChange}
          />
        </Accordion.Panel>
      </Accordion.Item>
    );
  });

  return (
    <ScrollArea h={height}>
      <Accordion
        onChange={handleAccordionChange}
        value={value || null}
        {...(window.env.E2E_TEST === 'true' && { transitionDuration: 0 })}
      >
        {items}
      </Accordion>
    </ScrollArea>
  );
};
