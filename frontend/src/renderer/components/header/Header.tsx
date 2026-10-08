import {
  ActionIcon,
  Box,
  Button,
  Center,
  ComboboxData,
  Container,
  Divider,
  Group,
  Image,
  Loader,
  Select,
  Title,
  Tooltip,
} from '@mantine/core';
import logoPath from '../../assets/imas_extra.png';
import { Configuration } from 'src/renderer/types';
import {
  IconPlus,
  IconCircleFilled,
  IconStar,
  IconStarFilled,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import {
  updateIbexConfig,
  fetchInfoVersion,
  readIbexConfig,
  useIsBusy,
} from '../../utils';

/**
 * Spins while the app is waiting on something - a request, a configuration
 * being loaded, a plot being built. Its box keeps its width when empty so the
 * header does not shift as it comes and goes.
 */
function BusyIndicator() {
  const busy = useIsBusy();
  return (
    <Box w={24} mt="lg">
      {busy && (
        <Loader size="sm" data-testid="busy-indicator" aria-label="Loading" />
      )}
    </Box>
  );
}

interface HeaderProps {
  active: Configuration;
  configurations: ComboboxData;
  handleAddConfiguration: () => void;
  handleRemoveConfiguration: () => void;
  handleSaveConfiguration: () => void;
  handleLoadConfiguration: () => void;
  handleSelectConfiguration: (value: string) => void;
  handleAddTree: () => void;
  defaultConfigPath: string;
  setDefaultConfigPath: (value: string) => void;
}

export const Header = ({
  active,
  configurations,
  handleAddConfiguration,
  handleRemoveConfiguration,
  handleSaveConfiguration,
  handleLoadConfiguration,
  handleSelectConfiguration,
  handleAddTree,
  defaultConfigPath,
  setDefaultConfigPath,
}: HeaderProps) => {
  const [isServerResponding, setIsServerResponding] = useState(true);

  const configurationButtons = (
    <Group>
      <Button
        onClick={handleAddConfiguration}
        data-testid="header-add-configuration"
        variant="outline"
      >
        Add
      </Button>
      <Button
        onClick={() => handleLoadConfiguration()}
        data-testid="header-load-configuration"
        variant="outline"
      >
        Load
      </Button>
      <Button
        onClick={handleSaveConfiguration}
        disabled={configurations.length === 0 || active?.saved}
        data-testid="header-save-configuration"
      >
        {active?.path ? 'Save' : 'Save as'}
      </Button>
      <Button
        onClick={handleRemoveConfiguration}
        disabled={configurations.length === 0}
        variant="outline"
        color="red"
        data-testid="header-delete-configuration"
      >
        Delete
      </Button>
    </Group>
  );

  const visualisationButtons = (
    <Group justify="flex-end">
      <Button
        onClick={handleAddTree}
        leftSection={<IconPlus size={20} />}
        disabled={!active}
      >
        Select URIs
      </Button>
    </Group>
  );

  const serverStatus = (
    <Group>
      <Tooltip openDelay={300} label="Server status">
        <IconCircleFilled
          size={20}
          color={isServerResponding ? 'green' : 'red'}
        />
      </Tooltip>
    </Group>
  );

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const timeoutId = window.setTimeout(() => {
          setIsServerResponding(false); // Timeout of 5 seconds
        }, 5000);
        await fetchInfoVersion();
        clearTimeout(timeoutId);
        setIsServerResponding(true);
      } catch (error) {
        console.error('Error checking server status:', error);
        setIsServerResponding(false);
      }
    };
    const interval = window.setInterval(fetchVersion, 10000); // Check server status each 10 seconds
    return () => clearInterval(interval);
  }, []);

  const updateDefaultConfiguration = async () => {
    const path = defaultConfigPath === active?.path ? '' : (active?.path ?? '');
    const userPreferences = await readIbexConfig();
    updateIbexConfig(path, userPreferences?.templateFolders);
    setDefaultConfigPath(path);
  };

  return (
    <Container fluid p={5}>
      <Group justify="space-between">
        <Group>
          <Center px={10}>
            <Image src={logoPath} alt="logo" width={35} height={35} />
            <Title order={2} fw="bold" ml={2}>
              Ibex Tool
            </Title>
          </Center>
          <Select
            w="15vw"
            maw="195px"
            data-testid="header-select-configuration"
            size="xs"
            key={active?.name || 'default'}
            placeholder="Configuration"
            data={configurations}
            value={active?.name}
            disabled={configurations?.length <= 0}
            label="Configurations"
            onChange={handleSelectConfiguration}
            leftSection={
              active?.path && (
                <Tooltip
                  openDelay={300}
                  label={
                    defaultConfigPath === active?.path
                      ? 'No longer set as default configuration.'
                      : 'Set as default configuration.'
                  }
                  position="top-start"
                  disabled={!active?.path}
                >
                  <ActionIcon
                    variant="transparent"
                    onClick={updateDefaultConfiguration}
                    disabled={!active?.path}
                  >
                    {defaultConfigPath === active?.path ? (
                      <IconStarFilled size={16} />
                    ) : (
                      <IconStar size={16} />
                    )}
                  </ActionIcon>
                </Tooltip>
              )
            }
            inputContainer={(children) => (
              <Tooltip
                openDelay={300}
                label="Select configuration to set as current configuration."
                position="top-start"
                disabled={configurations?.length <= 0}
              >
                {children}
              </Tooltip>
            )}
          />
          <BusyIndicator />
        </Group>
        <Group p={12}>
          {configurationButtons}
          <Divider orientation="vertical" />
          {visualisationButtons}
          <Divider orientation="vertical" />
          {serverStatus}
        </Group>
      </Group>
    </Container>
  );
};
