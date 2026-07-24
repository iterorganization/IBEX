import {
  ActionIcon,
  Autocomplete,
  Button,
  Center,
  Checkbox,
  Fieldset,
  FileInput,
  Group,
  Loader,
  Modal,
  Pagination,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { useIbexStore } from '../../stores';
import { useEffect, useMemo, useState } from 'react';
import { IconAlertSquareRounded, IconX, IconPlus } from '@tabler/icons-react';
import { Configuration, FormDbEntries, URISelectionData } from '../../types';
import { showNotification } from '@mantine/notifications';
import { useForm } from '@mantine/form';
import {
  fetchDataEntries,
  fetchURIExists,
  fetchURIFromPath,
  formatConfigBeforeLoadingURIs,
  getColorRandom,
  plotNodeUriLoaded,
  updateCustomDataTree,
} from '../../utils';
import { ConfirmModal } from '../../components';

interface VisualizationSelectIDSModalProps {
  opened: boolean;
  close: () => void;
}

interface FormIDS {
  file: File;
  uri: string;
}

export const VisualizationURIModal = ({
  opened,
  close,
}: VisualizationSelectIDSModalProps) => {
  const { active, updatedConfiguration } = useIbexStore();
  const [dataDbEntries, setDataDbEntries] = useState<URISelectionData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDbEntries, setIsLoadingDbEntries] = useState(false);
  const [isLoadedDbEntries, setIsLoadedDbEntries] = useState(false);
  const [activePage, setPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [fromURIisSuccess, setFromURIisSuccess] = useState(false);
  const [fromFileisSuccess, setFromFileisSuccess] = useState(false);
  const [localDatasetPath, setLocalDatasetPath] = useState('');
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [localFileError, setLocalFileError] = useState('');
  const [nodeURIsRequiredByTemplate, setNodeURIsRequiredByTemplate] = useState<
    string[]
  >([]);
  const [isMissingURIs, setIsMissingURIs] = useState(false);
  const [isDeletingAllUri, setIsDeletingAllUri] = useState(false);
  const dataURIsSelected = useMemo(
    () => dataDbEntries.filter((value) => value.isSelected),
    [dataDbEntries],
  );

  const formURI = useForm<FormIDS>({
    initialValues: {
      file: null,
      uri: '',
    },
  });

  const formDbEntries = useForm<FormDbEntries>({
    initialValues: {
      user: 'public',
      backend: '',
      database: '',
      version: '3',
    },
    validate: {
      user: (value) => (value.length < 1 ? 'User is required' : undefined),
      version: (value) =>
        value.length < 1 ? 'Version is required' : undefined,
    },
  });

  function getNextAvailableUriName(uriNameList: string[]): string {
    let i = 1;
    let uriName = 'URI-0';

    while (uriNameList.includes(uriName)) {
      uriName = `URI-${i}`;
      i++;
    }

    return uriName;
  }

  function properlyAddUriToUriList(
    uriList: URISelectionData[],
    newUri: URISelectionData,
  ): URISelectionData[] {
    if (uriList.map((value) => value.uri).includes(newUri.uri)) {
      // URI already present in list, leaving
      return uriList;
    }

    newUri.name = newUri.isSelected
      ? getNextAvailableUriName(uriList.map((value) => value.name))
      : '';

    uriList.push(newUri);
    return uriList;
  }

  function sortUri(uriList: URISelectionData[]) {
    uriList.sort((a, b) => {
      if (a.isSelected && !b.isSelected) return -1;
      if (!a.isSelected && b.isSelected) return 1;

      const lengthDiff = a.name.length - b.name.length;
      if (lengthDiff !== 0) return lengthDiff;

      return a.name.localeCompare(b.name);
    });
  }

  useEffect(() => {
    if (!opened) {
      const oldUriDb = dataDbEntries.map((entry) => ({
        ...entry,
        isSelected: false,
      }));

      let newUriDb: URISelectionData[] = [];

      if (active?.dataURI) {
        newUriDb = active.dataURI.map((dataUri) => ({
          ...dataUri,
          isSelected: true,
        }));
      }

      for (const uri of oldUriDb) {
        properlyAddUriToUriList(newUriDb, uri);
      }

      sortUri(newUriDb);
      setDataDbEntries(newUriDb);
    }
  }, [opened, active?.name]);

  useEffect(() => {
    const updateRequiredURIsList = () => {
      if (active?.dataPlot?.length) {
        // Get URIs used in dataPlots
        const nodeURIsRequired = Array.from(
          new Set(
            active.dataPlot.flatMap((d) => d.plot.map((p) => p.labelUri)),
          ),
        );
        setNodeURIsRequiredByTemplate(nodeURIsRequired);
      } else {
        // No URIs used in dataPlots
        setNodeURIsRequiredByTemplate([]);
      }
    };

    // When changing active config or adding / removing dataPlot, update required URIs list
    updateRequiredURIsList();
  }, [active?.name, active?.dataPlot]);

  useEffect(() => {
    const checkIfMissingURIs = () => {
      if (dataURIsSelected.length) {
        // Check if all required URIs are selected
        const missingURIs = nodeURIsRequiredByTemplate.filter(
          (uri) =>
            !dataURIsSelected.map((selected) => selected.name).includes(uri),
        );
        setIsMissingURIs(missingURIs?.length > 0 || false);
      } else {
        // No URI selected so missing if some URIs are required
        setIsMissingURIs(nodeURIsRequiredByTemplate?.length > 0);
      }
    };

    // When select/unslect uri or when required URIs list change, check if there is missing URIs
    checkIfMissingURIs();
  }, [dataURIsSelected, nodeURIsRequiredByTemplate]);

  useEffect(() => {
    // Get file from selected path (local dataset)
    const loadFile = async () => {
      if (!localDatasetPath) {
        return;
      }

      const response = await fetch(localDatasetPath);
      const blob = await response.blob();

      const splittedPath = localDatasetPath.split('/');
      const filename = splittedPath[splittedPath.length - 1];

      const file = new File([blob], filename, { type: blob.type });
      setLocalFile(file);

      if (file) {
        fetchDataIDSFromFile();
      }
    };
    loadFile();
  }, [localDatasetPath]);

  const tableHeaders = (
    <Table.Tr>
      <Table.Th>Select</Table.Th>
      <Table.Th>Name</Table.Th>
      <Table.Th>URI</Table.Th>
      {dataDbEntries.length ? (
        <Table.Th>
          <Tooltip label="Delete all URIs" openDelay={300}>
            <ActionIcon
              variant="filled"
              size="lg"
              color="red"
              onClick={() => setIsDeletingAllUri(true)}
            >
              <IconX
                color="white"
                style={{ width: '70%', height: '70%' }}
                stroke={1.5}
              />
            </ActionIcon>
          </Tooltip>
        </Table.Th>
      ) : undefined}
    </Table.Tr>
  );

  // Pagination logic: calculate rows for the current page
  const startIndex = (activePage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageData = dataDbEntries.slice(startIndex, endIndex);

  const tableRows = currentPageData.map((element, index) => (
    <Table.Tr key={`table-${element.name}-${index}`}>
      <Table.Td>
        <Checkbox
          radius="sm"
          size="sm"
          w={50}
          onChange={() => {
            handleCheckUri(element.uri);
          }}
          checked={element.isSelected}
        />
      </Table.Td>
      <Table.Td>{element.name}</Table.Td>
      <Table.Td>{element.uri}</Table.Td>
      <Table.Td>
        <Tooltip label="Delete the URI" openDelay={300}>
          <ActionIcon
            variant="transparent"
            aria-label="Remove URI"
            component="button"
            type="button"
            onClick={() =>
              setDataDbEntries((entries) =>
                entries.filter((entry) => entry.uri !== element.uri),
              )
            }
          >
            <IconX
              color="red"
              style={{ width: '70%', height: '70%' }}
              stroke={1.5}
            />
          </ActionIcon>
        </Tooltip>
      </Table.Td>
    </Table.Tr>
  ));

  /**
   * Handle check uri
   * @param uri
   * @param dataEntries
   * @returns
   */
  const handleCheckUri = (uri: string): void => {
    setDataDbEntries((prevEntries) =>
      prevEntries.map((entry) =>
        entry.uri === uri
          ? {
              ...entry,
              isSelected: !entry.isSelected,
              name: entry.isSelected
                ? ''
                : getNextAvailableUriName(
                    dataDbEntries.map((value) => value.name),
                  ),
            }
          : entry,
      ),
    );
  };

  /**
   * Update data URI
   * @returns
   */
  const updateDataURI = async (): Promise<void> => {
    const newCustomDataTree = updateCustomDataTree(
      active.customDataTree,
      dataDbEntries.filter((value) => value.isSelected),
    );

    // Update plot.nodeUri with selected URIs
    for (const dataPlot of active.dataPlot) {
      for (const plot of dataPlot.plot) {
        const splittedNodeUri = plot.nodeUri.split('#');
        const uriToApply = dataURIsSelected.find(
          (selectedUri) => selectedUri.name === plot.labelUri,
        )?.uri;
        plot.nodeUri = uriToApply + '#' + splittedNodeUri[1];
      }
    }

    // Get new data from BE
    const newListDataGridPlot = formatConfigBeforeLoadingURIs(active);
    const wantedDataPlot = await plotNodeUriLoaded(
      newListDataGridPlot,
      active.dataURI,
    );
    active.dataPlot = wantedDataPlot;

    const updatedActive: Configuration = {
      ...active,
      saved: false,
      customDataTree: newCustomDataTree,
      dataURI: dataDbEntries.filter((value) => value.isSelected),
    };

    updatedConfiguration(updatedActive);

    close();
  };

  /**
   * Verifies a given URI, updates data entries, and handles errors.
   * @param {string} uriToCheck - URI to verify.
   * @param {(arg1: string, arg2?: string) => void} errorSetter
   *   Function to handle errors:
   *   - Single argument → error message only (e.g., React state setter)
   *   - Two arguments → path + error message (e.g., form field setter)
   */
  const URIVerification = async (
    uriToCheck: string,
    errorSetter: (arg1: string, arg2?: string) => void,
  ) => {
    const setter = (message: string) => {
      if (errorSetter.length === 1) {
        errorSetter(message);
      } else {
        errorSetter('uri', message);
      }
    };

    const uri: URISelectionData = dataDbEntries.find(
      (value) => value.uri === uriToCheck,
    );

    if (uri) {
      // The uri is already present in the list, if it is unselected, select it, otherwise send an error notification to the user
      if (uri.isSelected) {
        setter('URI already added');
        showNotification({
          title: 'Error',
          message: 'URI already added',
          color: 'red',
        });
      } else {
        uri.isSelected = true;
        uri.name = getNextAvailableUriName(
          dataDbEntries.map((value) => value.name),
        );
        setDataDbEntries(structuredClone(dataDbEntries));
      }
      return;
    }

    // Verify if the URI exists
    const responseURIExists = await fetchURIExists(uriToCheck);

    if (!responseURIExists.exists) {
      setter('URI does not exist');
      showNotification({
        title: 'Error',
        message: 'URI does not exist',
        color: 'red',
      });
      return;
    }

    const newUri: URISelectionData = {
      name: getNextAvailableUriName(dataDbEntries.map((value) => value.name)),
      uri: uriToCheck,
      uriColor: getColorRandom(),
      isSelected: true,
    };

    setDataDbEntries([...dataDbEntries, newUri]);
    if (errorSetter.length === 1) {
      setFromURIisSuccess(false);
      setFromFileisSuccess(true);
    } else {
      setFromURIisSuccess(true);
      setFromFileisSuccess(false);
    }
  };

  /**
   * Fetch IDS data from URI
   * @returns {Promise<void>}
   * Return data uri with name and occurrences
   *
   */
  async function fetchDataIDSFromURI() {
    if (!formURI.values.uri) {
      console.error('URI is empty.');
      formURI.setFieldError('uri', 'Please provide a valid URI');
      return;
    }

    try {
      setIsLoading(true);
      await URIVerification(formURI.values.uri, formURI.setFieldError);
    } catch (error) {
      console.error('Error:', error.message || error);
      formURI.setFieldError('uri', error.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }

  const handleLoadLocalFile = async () => {
    await window.api.fs
      .getFilePathDialog('*')
      .then(async (path: string | null) => {
        if (path) {
          setLocalDatasetPath(path);
          setLocalFileError('');
        }
      });
  };

  /**
   * Fetch IDS data from file
   * @returns {Promise<void>}
   * Return data uri with name and occurrences
   */
  async function fetchDataIDSFromFile() {
    try {
      setIsLoading(true);
      const responseURIExists = await fetchURIFromPath(localDatasetPath);

      await URIVerification(responseURIExists.uri, setLocalFileError);
    } catch (error) {
      console.error('Error:', error.message || error);
      setLocalFileError(error.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Fetch IDS data from db entries
   * @returns {Promise<void>}
   * Return data uri with name and occurrences
   */
  async function fetchDbEntries() {
    try {
      const config = await window.api.getConfig();
      if (!config) {
        throw new Error('Failed to load configuration');
      }

      setIsLoadingDbEntries(true);
      const response = await fetchDataEntries(formDbEntries.values);

      const existingMap = new Map<string, URISelectionData>(
        dataDbEntries.map((e) => [e.uri, e]),
      );

      // Deduplicate URIs (existing + new)
      const allUris = Array.from(
        new Set([...dataDbEntries.map((e) => e.uri), ...response.entries]),
      );

      const newUriNameList = dataDbEntries.map((e) => e.name);

      const newUriData: URISelectionData[] = allUris.map((uri) => {
        const existing = existingMap.get(uri);
        const name = existing ? existing.name : '';
        const uriColor = existing ? existing.uriColor : getColorRandom();
        const isSelected = existing ? existing.isSelected : false;

        if (!existing) newUriNameList.push(name);

        return { uri, name, uriColor, isSelected };
      });

      setDataDbEntries(newUriData);
      showNotification({
        title: 'Success',
        message: 'Data successfully fetched from db entries',
        color: 'green',
      });
    } catch (error) {
      console.error('Promise rejected:', error);
      formDbEntries.setErrors({
        user: 'Error occurred while fetching data',
        backend: 'Error occurred while fetching data',
        database: 'Error occurred while fetching data',
        version: 'Error occurred while fetching data',
      });
      showNotification({
        title: 'Error',
        message: 'Error to search IDS',
        color: 'red',
      });
    } finally {
      setIsLoadingDbEntries(false);
      setIsLoadedDbEntries(true);
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={close}
      title="Select URIs"
      size="90%"
      centered
      data-testid="config-uri-selection-modal"
      {...(window.env.E2E_TEST === 'true' && {
        transitionProps: { duration: 0 },
      })}
    >
      <Group justify="space-between" mb={10}>
        <FileInput
          clearable
          label="Upload local dataset"
          placeholder="Select local imas file"
          value={localFile}
          error={localFileError}
          onClick={handleLoadLocalFile}
          onChange={(value) => {
            if (value === null) {
              setLocalFile(null);
              setLocalFileError('');
            }
          }}
          w="calc(50% - 30px)"
          styles={{
            input: {
              //green if success else default
              borderColor: fromFileisSuccess ? '#00FF00' : '',
            },
          }}
          disabled={isLoading || isLoadingDbEntries}
        />

        <form
          onSubmit={formURI.onSubmit(() => {
            fetchDataIDSFromURI();
          })}
          style={{
            width: 'calc(50% - 30px)',
          }}
        >
          <Autocomplete
            data-testid="config-uri-selection-modal-uri-text-input"
            label="Write/Paste your URI"
            placeholder="Enter your uri"
            data={dataDbEntries.map((entry) => entry.uri)}
            rightSection={
              <ActionIcon
                variant="filled"
                aria-label="Add URI"
                component="button"
                type="submit"
                disabled={isLoading || isLoadingDbEntries}
              >
                <IconPlus
                  data-testid="config-uri-selection-modal-add-uri-button"
                  style={{ width: '70%', height: '70%' }}
                  stroke={1.5}
                />
              </ActionIcon>
            }
            styles={{
              input: {
                //green if success else default
                borderColor: fromURIisSuccess
                  ? '#00FF00'
                  : isLoadedDbEntries && dataDbEntries.length > 0
                    ? '#FFDD00'
                    : '',
              },
            }}
            disabled={isLoading || isLoadingDbEntries}
            {...formURI.getInputProps('uri')}
          />
        </form>
      </Group>

      <Center>
        <Text>or</Text>
      </Center>

      <form
        onSubmit={formDbEntries.onSubmit(() => {
          fetchDbEntries();
        })}
      >
        <Fieldset
          legend="Legacy parameters"
          w="100%"
          mb={10}
          disabled={isLoading || isLoadingDbEntries}
        >
          <Group justify="space-between">
            <TextInput
              label="User"
              placeholder="Enter user name"
              withAsterisk
              {...formDbEntries.getInputProps('user')}
              w="calc(20% - 15px)"
            />
            <TextInput
              label="Backend"
              placeholder="Enter backend name"
              w="calc(20% - 15px)"
              {...formDbEntries.getInputProps('backend')}
              withAsterisk
            />
            <TextInput
              label="Database"
              placeholder="Enter database name"
              w="calc(20% - 15px)"
              {...formDbEntries.getInputProps('database')}
              withAsterisk
            />
            <TextInput
              label="Version"
              placeholder="Enter version"
              w="calc(20% - 15px)"
              {...formDbEntries.getInputProps('version')}
              withAsterisk
            />
            <Button
              w="calc(20% - 15px)"
              mt={25}
              type="submit"
              leftSection={
                isLoadingDbEntries && <Loader color="blue" size="sm" />
              }
            >
              Search db entries
            </Button>
          </Group>
        </Fieldset>
      </form>

      {isMissingURIs && nodeURIsRequiredByTemplate?.length > 0 && (
        <Tooltip
          position="top-start"
          label={`Requires ${nodeURIsRequiredByTemplate.length > 1 ? ' these URIs' : ' this URI'}: "${nodeURIsRequiredByTemplate.join(', ')}".`}
        >
          <Group gap={10} w="fit-content">
            <IconAlertSquareRounded size={20} color="red" />
            <Text
              size="sm"
              c="red"
            >{`The selected template requires ${nodeURIsRequiredByTemplate.length} URIs.`}</Text>
          </Group>
        </Tooltip>
      )}
      <Table withTableBorder>
        <Table.Thead>{tableHeaders}</Table.Thead>

        <Table.Caption>
          {isLoading && <Loader color="blue" />}
          {dataDbEntries.length === 0 && !isLoading && (
            <Text>No uri added</Text>
          )}
        </Table.Caption>

        <Table.Tbody>{tableRows}</Table.Tbody>
      </Table>

      <Group justify="center" mt={20}>
        <Pagination
          total={Math.ceil(dataDbEntries.length / itemsPerPage)}
          value={activePage}
          onChange={setPage}
        />
      </Group>

      <Group justify="flex-end" mt={20}>
        <Button
          data-testid="config-uri-selection-modal-validate-button"
          disabled={!dataURIsSelected.length || isMissingURIs}
          onClick={updateDataURI}
        >
          Validate
        </Button>
      </Group>
      <ConfirmModal
        isOpen={isDeletingAllUri}
        onClose={() => setIsDeletingAllUri(false)}
        onConfirm={() => {
          setDataDbEntries([]);
          setIsDeletingAllUri(false);
        }}
      >
        <Text size="sm">
          Are you sure you want to delete all the listed URIs ?
        </Text>
      </ConfirmModal>
    </Modal>
  );
};
