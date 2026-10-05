import {
  Accordion,
  ColorSwatch,
  Group,
  ScrollArea,
  SimpleGrid,
  Text,
  Tooltip,
} from '@mantine/core';
import {
  CustomTreeData,
  CustomTreeNodeData,
  URITreeNodeData,
} from 'src/renderer/types';
import { TreeLibrary } from '../../components';
import { useIbexStore } from '../../stores';

interface VisualizationTreeProps {
  customDataTree: CustomTreeData[];
  checkedNodes: URITreeNodeData[];
  /** The data entries whose item is open; several can be at once. */
  value: string[];
  /** A search's results per data entry, or `null` when not searching. */
  searchResults: Record<string, CustomTreeNodeData[]> | null;
  handleAccordionChange(value: string[]): void;
  handleSelectChildren: (nodeUri: string) => Promise<boolean>;
  getNodesChecked: (nodes: URITreeNodeData[]) => void;
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
  checkedNodes,
  value,
  searchResults,
  handleAccordionChange,
  handleSelectChildren,
  getNodesChecked,
}: VisualizationTreeProps) => {
  // Both are plain ids in the ui slice, so the selectors are already stable and
  // the JSON.stringify memos they used to need are gone.
  const metadataGridId = useIbexStore((state) => state.metadataGridId);
  const customizingGridId = useIbexStore((state) => state.customizing?.id);

  const items = customDataTree.map((item) => {
    const results = searchResults?.[item.uri];
    return (
      <Accordion.Item
        data-testid={`uriAccordion-${item.uri}`}
        key={`accodion-${item.uri}`}
        value={`${item.uri}`}
      >
        <Accordion.Control style={{ userSelect: 'none' }}>
          <AccordionLabel
            label={item.name}
            description={item.uri}
            color={item?.uriColor}
          />
        </Accordion.Control>
        <Accordion.Panel>
          {searchResults && !results?.length ? (
            <Text size="sm" c="dimmed" data-testid={`noMatch-${item.uri}`}>
              No match
            </Text>
          ) : (
            <TreeLibrary
              key={searchResults ? 'search' : 'browse'}
              mode={searchResults ? 'search' : 'browse'}
              uri={item.uri}
              treeData={results ?? item.data}
              checkedNodes={checkedNodes}
              metadataGridLayout={metadataGridId}
              customizedGridLayout={customizingGridId}
              handleSelectChildren={handleSelectChildren}
              getCheckedNodes={getNodesChecked}
            />
          )}
        </Accordion.Panel>
      </Accordion.Item>
    );
  });

  return (
    <ScrollArea style={{ flex: 1, minHeight: 0 }}>
      <Accordion
        multiple
        onChange={handleAccordionChange}
        value={value}
        {...(window.env.E2E_TEST === 'true' && { transitionDuration: 0 })}
      >
        {items}
      </Accordion>
    </ScrollArea>
  );
};
