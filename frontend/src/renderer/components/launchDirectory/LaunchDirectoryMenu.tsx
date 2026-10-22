import { Menu, ScrollArea, Text } from '@mantine/core';
import { ReactElement, ReactNode, useState } from 'react';
import {
  LaunchDirectoryKind,
  LaunchDirectoryListing,
} from 'src/renderer/types';

interface LaunchDirectoryMenuProps {
  kind: LaunchDirectoryKind;
  // Opens the menu on click; must accept a ref (a Mantine button does)
  target: ReactElement;
  // Called with the path of the entry clicked
  onSelect: (path: string) => void;
  // Items shown above the launch directory section (e.g. "Browse…")
  children?: ReactNode;
  testId: string;
}

/**
 * Menu listing what can be opened from the directory IBEX was started from,
 * read afresh each time it opens. It is the shortcut to that directory: the
 * native open dialog cannot start there on every desktop (XDG portal < 4).
 */
export const LaunchDirectoryMenu = ({
  kind,
  target,
  onSelect,
  children,
  testId,
}: LaunchDirectoryMenuProps) => {
  const [listing, setListing] = useState<LaunchDirectoryListing | null>(null);
  const [error, setError] = useState('');

  const readListing = async () => {
    try {
      setListing(await window.api.fs.listLaunchDirectory(kind));
      setError('');
    } catch (caught) {
      setListing(null);
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const emptyText =
    kind === 'configs' ? 'No .json files' : 'No data entries found';

  return (
    <Menu
      shadow="md"
      position="bottom-start"
      onOpen={readListing}
      {...(window.env.E2E_TEST === 'true' && {
        transitionProps: { duration: 0 },
      })}
    >
      <Menu.Target>{target}</Menu.Target>
      <Menu.Dropdown data-testid={testId}>
        {children}
        {children && <Menu.Divider />}
        <Menu.Label maw={400} style={{ overflowWrap: 'anywhere' }}>
          {listing ? `In ${listing.dir}` : 'Launch directory'}
        </Menu.Label>
        <ScrollArea.Autosize mah={320} type="auto">
          {listing?.entries.map((entry) => (
            <Menu.Item
              key={entry.path}
              onClick={() => onSelect(entry.path)}
              data-testid={`${testId}-entry`}
            >
              {entry.label}
            </Menu.Item>
          ))}
        </ScrollArea.Autosize>
        {listing && listing.entries.length === 0 && (
          <Text size="sm" c="dimmed" px="sm" py={4}>
            {emptyText}
          </Text>
        )}
        {error && (
          <Text size="sm" c="red" px="sm" py={4} maw={400}>
            {error}
          </Text>
        )}
      </Menu.Dropdown>
    </Menu>
  );
};
