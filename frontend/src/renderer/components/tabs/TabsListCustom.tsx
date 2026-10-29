import { useRef, useState } from 'react';
import {
  ActionIcon,
  ColorSwatch,
  FloatingIndicator,
  Group,
  ScrollArea,
  Tabs,
  Tooltip,
} from '@mantine/core';
import classes from './TabsListCustom.module.css';
import { IconArrowLeft, IconCheck, IconX } from '@tabler/icons-react';

export interface TabItem {
  /** Tab value, unique in the list. */
  value: string;
  label: string;
  /** Colour of the curve the tab customizes, shown as a dot. */
  color?: string;
  /** Shown on hover, e.g. the full node URI. */
  title?: string;
}

interface TabsListCustomProps {
  data: TabItem[];
  value: string | null;
  usedFor: 'metadatas' | 'personalization';
  closeWithoutSaving: () => void;
  saveAndClose?: () => void;
}

export const TabsListCustom = ({
  data,
  value,
  usedFor,
  closeWithoutSaving,
  saveAndClose,
}: TabsListCustomProps) => {
  const [rootRef, setRootRef] = useState<HTMLDivElement | null>(null);
  const [controlsRefs, setControlsRefs] = useState<
    Record<string, HTMLButtonElement | null>
  >({});
  const setControlRef = (val: string) => (node: HTMLButtonElement) => {
    controlsRefs[val] = node;
    setControlsRefs(controlsRefs);
  };
  const barRef = useRef<HTMLDivElement>(null);

  return (
    <Group mt={2} ref={barRef}>
      {usedFor === 'metadatas' ? (
        <ActionIcon
          variant="filled"
          aria-label="Metadatas"
          onClick={() => closeWithoutSaving()}
        >
          <IconArrowLeft style={{ width: '70%', height: '70%' }} stroke={1.5} />
        </ActionIcon>
      ) : (
        <>
          {saveAndClose && (
            <Tooltip label="Save customization and close">
              <ActionIcon
                variant="filled"
                aria-label="Metadatas"
                data-testid="customization-save-button"
                color="yellow"
                onClick={() => saveAndClose()}
              >
                <IconCheck
                  style={{ width: '70%', height: '70%' }}
                  stroke={1.5}
                />
              </ActionIcon>
            </Tooltip>
          )}
          <Tooltip label="Cancel customization">
            <ActionIcon
              variant="filled"
              aria-label="Metadatas"
              color="red"
              onClick={() => closeWithoutSaving()}
            >
              <IconX style={{ width: '70%', height: '70%' }} />
            </ActionIcon>
          </Tooltip>
        </>
      )}
      <ScrollArea
        type="hover"
        scrollHideDelay={0}
        scrollbarSize={6}
        offsetScrollbars
        maw={
          usedFor === 'metadatas'
            ? barRef.current?.offsetWidth - 50
            : barRef.current?.offsetWidth - 100
        }
      >
        <Tabs.List
          ref={setRootRef}
          className={classes.list}
          style={{
            flexWrap: 'nowrap',
            whiteSpace: 'nowrap',
          }}
        >
          {data.length > 0 &&
            data.map((item) => (
              <Tooltip
                key={item.value}
                label={item.title}
                disabled={!item.title}
                openDelay={500}
              >
                <Tabs.Tab
                  value={item.value}
                  ref={setControlRef(item.value)}
                  className={classes.tab}
                  data-testid={`customization-tab-${item.label}`}
                  leftSection={
                    item.color && <ColorSwatch color={item.color} size={10} />
                  }
                >
                  {item.label}
                </Tabs.Tab>
              </Tooltip>
            ))}

          <FloatingIndicator
            target={value ? controlsRefs[value] : null}
            parent={rootRef}
            className={classes.indicator}
          />
        </Tabs.List>
      </ScrollArea>
    </Group>
  );
};
