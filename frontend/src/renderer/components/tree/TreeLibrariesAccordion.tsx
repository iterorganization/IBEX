import {
  Accordion,
  Button,
  ColorSwatch,
  Group,
  ScrollArea,
  SimpleGrid,
  Text,
  Tooltip,
} from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
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
  /** The data entry a search not over all of them reads, if any. */
  searchedUri?: string;
  /** Runs the search shown in a data entry it has not been run in. */
  handleSearchEntry: (uri: string) => void;
  handleAccordionChange(value: string[]): void;
  handleSelectChildren: (nodeUri: string) => Promise<boolean>;
  getNodesChecked: (nodes: URITreeNodeData[]) => void;
  handleCheckInAllUris: (nodeValue: string, check: boolean) => void;
}

interface AccordionLabelProps {
  label: string;
  description: string;
  color: string;
  /** Whether a search not over all data entries reads this one. */
  searched: boolean;
}

function AccordionLabel({
  label,
  description,
  color,
  searched,
}: AccordionLabelProps) {
  return (
    <Group wrap="nowrap">
      <ColorSwatch color={color} />
      {searched && (
        <Tooltip label="The search runs in this URI" position="right">
          <IconSearch
            size={16}
            stroke={2.5}
            color="var(--mantine-primary-color-filled)"
            data-testid="searched-uri"
            style={{ flexShrink: 0 }}
          />
        </Tooltip>
      )}
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
  searchedUri,
  handleSearchEntry,
  handleAccordionChange,
  handleSelectChildren,
  getNodesChecked,
  handleCheckInAllUris,
}: VisualizationTreeProps) => {
  // Both are plain ids in the ui slice, so the selectors are already stable and
  // the JSON.stringify memos they used to need are gone.
  const metadataGridId = useIbexStore((state) => state.metadataGridId);
  const customizingGridId = useIbexStore((state) => state.customizing?.id);

  const items = customDataTree.map((item) => {
    const results = searchResults?.[item.uri];
    const searched = item.uri === searchedUri;
    return (
      <Accordion.Item
        data-testid={`uriAccordion-${item.uri}`}
        key={`accodion-${item.uri}`}
        value={`${item.uri}`}
      >
        <Accordion.Control
          style={{
            userSelect: 'none',
            ...(searched && {
              backgroundColor: 'var(--mantine-primary-color-light)',
            }),
          }}
        >
          <AccordionLabel
            label={item.name}
            description={item.uri}
            color={item?.uriColor}
            searched={searched}
          />
        </Accordion.Control>
        <Accordion.Panel>
          {searchResults && !results ? (
            <Group gap="xs" data-testid={`notSearched-${item.uri}`}>
              <Text size="sm" c="dimmed">
                Not searched in this URI
              </Text>
              <Button
                size="compact-xs"
                variant="light"
                leftSection={<IconSearch size={12} />}
                onClick={() => handleSearchEntry(item.uri)}
                data-testid={`searchEntry-${item.uri}`}
              >
                Search here
              </Button>
            </Group>
          ) : searchResults && !results.length ? (
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
              handleCheckInAllUris={handleCheckInAllUris}
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
