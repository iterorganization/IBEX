import { AppShell, Text } from '@mantine/core';
import { Outlet } from 'react-router-dom';
import { useIbexStore } from '../stores';
import { useDisclosure } from '@mantine/hooks';
import {
  BaseCoordinates,
  BaseDataPlotly,
  ConfigForm,
  Configuration,
  ConfigurationToSave,
  Coordinates,
  DataGridPlot,
  DataGridPlotToSave,
  StartupRequest,
} from '../types';
import {
  ConfigCreateModal,
  ConfigRenameModal,
  ConfirmModal,
  Header,
} from '../components';
import { PreferenceModal } from '../components/preferences/PreferenceModal';
import {
  updateIbexConfig,
  formatConfigBeforeLoadingURIs,
  formatSignalOperandsToSave,
  plotNodeUriLoaded,
  updateCustomDataTree,
  readIbexConfig,
  formatGeometriesToSave,
  trackBusy,
  afterNextPaint,
  fetchURIExists,
  getColorRandom,
  missingTemplateLabels,
  startupDataURI,
  uniqueConfigurationName,
} from '../utils';
import { VisualizationURIModal } from '../pages';
import { showNotification } from '@mantine/notifications';
import { useEffect, useState } from 'react';
import { TemplateModalContent } from '../components/preferences/TemplateModalContent';

export function MainLayout() {
  const {
    active,
    configurations,
    addConfiguration,
    removeConfiguration,
    renameConfiguration,
    updatedConfiguration,
    setActive,
  } = useIbexStore();
  const [
    isConfigCreateModalOpen,
    { open: openConfigCreateModal, close: closeConfigCreateModal },
  ] = useDisclosure(false);
  const [
    isConfigDeleteModalOpen,
    { open: openConfigDeleteModal, close: closeConfigDeleteModal },
  ] = useDisclosure(false);
  const [
    isConfigRenameModalOpen,
    { open: openConfigRenameModal, close: closeConfigRenameModal },
  ] = useDisclosure(false);
  const [
    isAddTreeModalOpen,
    { open: openAddTreeModal, close: closeAddTreeModal },
  ] = useDisclosure(false);
  const [defaultConfigPath, setDefaultConfigPath] = useState('');
  const [isSavingTemplatePreferences, setIsSavingTemplatePreferences] =
    useState(false);

  const [
    isTemplateModalOpen,
    { open: openTemplateCreateModal, close: closeTemplateModal },
  ] = useDisclosure(false);

  // Used in useEffect to load configuration once in dev mode
  interface InitWindow extends Window {
    __didInit?: boolean;
  }
  const w = window as InitWindow;

  const handleAddConfiguration = async (
    config: ConfigForm,
    templatePath?: string,
  ) => {
    let dataPlotFromTemplate: DataGridPlot[];
    if (templatePath) {
      const rawFileContent: string = await window.api.fs.readFile(templatePath);
      const fileContent: Configuration = rawFileContent.trim()
        ? JSON.parse(rawFileContent)
        : {};
      if (fileContent?.dataPlot && Array.isArray(fileContent.dataPlot)) {
        // Get data plots from template
        dataPlotFromTemplate = fileContent.dataPlot;
      }
    }

    const newConfig: Configuration = {
      name: config.name,
      dataURI: [],
      customDataTree: [],
      dataPlot: dataPlotFromTemplate ?? [],
      checkedNodeURI: [],
    };
    addConfiguration(newConfig);
    setActive(newConfig.name);
  };

  const handleRemoveConfiguration = () => {
    removeConfiguration(active?.name);
    closeConfigDeleteModal();
  };

  /** The active configuration as written to an IbexState file. */
  const buildIbexState = (): ConfigurationToSave => {
    const dataGridWithoutData: DataGridPlotToSave[] = active.dataPlot.map(
      (dataGrid: DataGridPlot): DataGridPlotToSave => ({
        title: dataGrid.title,
        dataType: dataGrid.dataType,
        isTitleOverwritten: dataGrid.isTitleOverwritten,
        displayErrorBand: dataGrid.displayErrorBand,
        displayGrid: dataGrid.displayGrid,
        forceXyRatio: dataGrid.forceXyRatio,
        synchronizedGrids: dataGrid.synchronizedGrids,
        downsampled_method: dataGrid?.downsampled_method,
        downsampled_size: dataGrid?.downsampled_size,
        interpolated_method: dataGrid.interpolated_method,
        is_geometry_node: dataGrid.is_geometry_node,
        geometries: formatGeometriesToSave(
          dataGrid?.geometries,
          active.dataURI,
        ),
        xAxisData: dataGrid.xAxisData,
        yAxisData: dataGrid.yAxisData,
        y2AxisData: dataGrid?.y2AxisData,
        i: dataGrid.i,
        x: dataGrid.x,
        y: dataGrid.y,
        w: dataGrid.w,
        h: dataGrid.h,
        coordinates: dataGrid.coordinates.map(
          (coord: Coordinates): BaseCoordinates => {
            return {
              axeIndex: coord.axeIndex,
              path: coord.path,
              target: coord.target,
              valueIndex: coord.valueIndex,
              range: coord?.range,
              rangeValues: coord?.rangeValues,
            };
          },
        ),
        plot: dataGrid.plot.map((plot): BaseDataPlotly => {
          const suffix = plot.nodeUri.split('#')[1];
          const newNodeUri = `${plot.labelUri}#${suffix}`;

          return {
            nodeUri: newNodeUri,
            yaxis: plot?.yaxis || '',
            labelUri: plot.labelUri,
            line: plot?.line || {},
            customPreferences: plot?.customPreferences || {},
            mode: plot?.mode || 'line',
            smoothing: plot?.smoothing,
            // Signal operands are stored the same way as nodeUri, so that they
            // are remapped onto the selected data entries when reloading
            operations: formatSignalOperandsToSave(
              plot?.operations,
              dataGrid.plot,
            ),
          };
        }),
      }),
    );

    // Remove ' (x)' at the end of the name if there has been name duplicates during configuration load
    const correctedName = active.name.replace(/\s*\(\d+\)$/, '');

    return {
      name: correctedName,
      dataURI: active.dataURI,
      lastURIInput: active.lastURIInput,
      lastLocalDataSetSelected: active.lastLocalDataSetSelected,
      dataPlot: dataGridWithoutData,
    };
  };

  /** Write the active configuration to `path`, which it is then saved to. */
  const writeConfiguration = async (path: string) => {
    const result = await window.api.fs.writeFile(
      path,
      JSON.stringify(buildIbexState(), null, 2),
    );
    if (result?.success === false) {
      showNotification({
        title: 'Configuration not saved',
        message: `Cannot write '${path}': ${result.message}`,
        color: 'red',
      });
      return;
    }

    updatedConfiguration({ ...active, path, saved: true });
  };

  /** Save the active configuration to a file the user picks. */
  const handleSaveConfigurationAs = async () => {
    // Suggest the folder of the current file, if any
    const folder = active.path?.replace(/[^/]*$/, '') ?? '';
    const path: string = await window.api.fs.saveAsDialog(
      `${folder}${active.name}IbexState.json`,
      'json',
    );
    if (path) await writeConfiguration(path);
  };

  const handleSaveConfiguration = async () =>
    active?.path
      ? writeConfiguration(active.path)
      : handleSaveConfigurationAs();

  /**
   * Add a configuration from an IbexState (read from a file, or built from
   * the command line) and fetch the data of its plots.
   * @param ibexState The state; its plots refer to data entries by name
   * @param path The file the state was read from, if any
   */
  const loadIbexState = async (
    ibexState: ConfigurationToSave,
    path?: string,
  ) => {
    // Read the store rather than the rendered `configurations`: several
    // states can be loaded in a row, before this component renders again.
    const loadedConfigurations = useIbexStore.getState().configurations;

    const configurationNameAlreadyExists = loadedConfigurations.some(
      (value) => value.name == ibexState.name,
    );

    if (configurationNameAlreadyExists) {
      const configurationAlreadyLoaded =
        path && loadedConfigurations.some((value) => value.path == path);

      if (configurationAlreadyLoaded) {
        showNotification({
          title: 'Configuration already loaded',
          message: `The configuration ${ibexState.name} is already loaded.`,
          color: 'yellow',
        });
        return;
      }

      // We have a duplicate configuration name
      // We will add a (x) to the name until there is no name duplicate in the configuration list
      let offsetName = 1;
      let newConfigurationName = ibexState.name;
      while (
        loadedConfigurations.some((value) => value.name == newConfigurationName)
      ) {
        newConfigurationName = ibexState.name + ` (${offsetName})`;
        offsetName++;
      }

      ibexState.name = newConfigurationName;
    }

    const newListDataGridPlot = formatConfigBeforeLoadingURIs(ibexState);
    const newConfig: Configuration = {
      name: ibexState.name,
      dataURI: ibexState.dataURI,
      customDataTree: updateCustomDataTree([], ibexState.dataURI),
      checkedNodeURI: [],
      dataPlot: await plotNodeUriLoaded(newListDataGridPlot, ibexState.dataURI),
      saved: Boolean(path),
      path: path,
    };

    addConfiguration(newConfig);
    setActive(newConfig.name);
    await afterNextPaint();
  };

  const handleLoadConfiguration = async (path?: string) => {
    if (!path) {
      // If no path is provided, the file selector is opened.
      path = await window.api.fs.getFilePathDialog('json');
    }

    if (!path) {
      // Stop load if the user has cancelled the selection (or if path is still null)
      return;
    }

    // Busy from reading the file until its grids are drawn; the file dialog
    // above is the user's time, not the app's.
    await trackBusy(async () => {
      const data: string = await window.api.fs.readFile(path);
      await loadIbexState(JSON.parse(data), path);
    });
  };

  /**
   * Open the data entries given on the command line (--uri) in a new
   * configuration, applying a template (--template) when one is given.
   */
  const handleOpenUris = async (request: StartupRequest) =>
    trackBusy(async () => {
      const exists = await Promise.all(
        request.uris.map((uri) =>
          fetchURIExists(uri)
            .then((response) => Boolean(response?.exists))
            .catch(() => false),
        ),
      );
      const dataURI = startupDataURI(request.uris, exists, getColorRandom);

      const notFound = request.uris.filter((_uri, index) => !exists[index]);
      if (notFound.length) {
        showNotification({
          title: 'Data entries not found',
          message: `Not opened: ${notFound.join(', ')}`,
          color: 'red',
          autoClose: false,
        });
      }
      if (!dataURI.length && !request.template) return;

      const takenNames = useIbexStore
        .getState()
        .configurations.map((configuration) => configuration.name);
      const name = uniqueConfigurationName(
        request.name ?? 'config',
        takenNames,
      );
      if (request.name && name !== request.name) {
        showNotification({
          title: 'Configuration name already used',
          message: `The configuration is named '${name}' instead of '${request.name}'.`,
          color: 'yellow',
        });
      }

      let templateDataPlot: DataGridPlotToSave[] = [];
      if (request.template) {
        const template: ConfigurationToSave = JSON.parse(
          await window.api.fs.readFile(request.template),
        );
        templateDataPlot = Array.isArray(template?.dataPlot)
          ? template.dataPlot
          : [];
      }

      const missingLabels = missingTemplateLabels(templateDataPlot, dataURI);
      if (!missingLabels.length) {
        await loadIbexState({ name, dataURI, dataPlot: templateDataPlot });
        return;
      }

      // The template needs more data entries than were opened: let the user
      // add them, as when creating a configuration from a template by hand.
      const newConfig: Configuration = {
        name,
        dataURI,
        customDataTree: updateCustomDataTree([], dataURI),
        checkedNodeURI: [],
        dataPlot: templateDataPlot as DataGridPlot[],
      };
      addConfiguration(newConfig);
      setActive(newConfig.name);
      openAddTreeModal();
      showNotification({
        title: 'Data entries missing for the template',
        message: `The template also uses ${missingLabels.join(', ')}: add data entries for them.`,
        color: 'yellow',
        autoClose: false,
      });
    });

  const handleSelectConfiguration = (value: string) => {
    setActive(value);
  };

  useEffect(() => {
    // Listener to open template modal when triggered
    window.api.preferences.onOpenTemplateModal(() => openTemplateCreateModal());

    // Used to load configuration once in dev mode
    if (w.__didInit) return;
    w.__didInit = true;

    // Get default configuration path to load
    const loadDefaultConfiguration = async function () {
      const userPreferences = await readIbexConfig();
      try {
        // Load default configuration
        if (userPreferences?.defaultConfigPath) {
          await handleLoadConfiguration(userPreferences.defaultConfigPath);
          setDefaultConfigPath(userPreferences.defaultConfigPath);
        }
      } catch (error) {
        if (!userPreferences?.defaultConfigPath) return;
        console.warn('Default configuration file not found. ', error);
        showNotification({
          title: 'Default configuration file not found',
          message: `The default configuration is no longer in path '${userPreferences.defaultConfigPath}'.`,
          color: 'yellow',
        });
        updateIbexConfig(
          userPreferences.defaultConfigPath,
          userPreferences.templateFolders,
        );
      }
    };

    // What the command line asked for replaces the default configuration
    const loadStartupConfigurations = async function () {
      const request = await window.api.getStartupRequest();

      if (request.configs.length) {
        for (const path of request.configs) {
          try {
            await handleLoadConfiguration(path);
          } catch (error) {
            console.warn(`Cannot load configuration '${path}'. `, error);
            showNotification({
              title: 'Cannot load configuration',
              message: `'${path}': ${error?.message ?? error}`,
              color: 'red',
              autoClose: false,
            });
          }
        }
      } else if (request.uris.length) {
        try {
          await handleOpenUris(request);
        } catch (error) {
          console.warn('Cannot open the data entries. ', error);
          showNotification({
            title: 'Cannot open the data entries',
            message: `${error?.message ?? error}`,
            color: 'red',
            autoClose: false,
          });
        }
      } else {
        await loadDefaultConfiguration();
      }
    };

    loadStartupConfigurations();
  }, []);

  return (
    <AppShell header={{ height: 70 }}>
      <AppShell.Header>
        <Header
          active={active}
          configurations={configurations.map((configuration) => ({
            value: configuration?.name,
            label: configuration?.name,
          }))}
          handleAddConfiguration={openConfigCreateModal}
          handleRemoveConfiguration={() =>
            !active?.saved
              ? openConfigDeleteModal()
              : removeConfiguration(active?.name)
          }
          handleRenameConfiguration={openConfigRenameModal}
          handleSaveConfiguration={handleSaveConfiguration}
          handleSaveConfigurationAs={handleSaveConfigurationAs}
          handleLoadConfiguration={handleLoadConfiguration}
          handleSelectConfiguration={handleSelectConfiguration}
          handleAddTree={openAddTreeModal}
          defaultConfigPath={defaultConfigPath}
          setDefaultConfigPath={setDefaultConfigPath}
        />
      </AppShell.Header>
      <AppShell.Main>
        <Outlet />
        <ConfigCreateModal
          isOpen={isConfigCreateModalOpen}
          configurationsNames={configurations.map((c) => c?.name)}
          onClose={closeConfigCreateModal}
          handleAddConfiguration={handleAddConfiguration}
          handleAddTree={openAddTreeModal}
        />

        <ConfigRenameModal
          isOpen={isConfigRenameModalOpen}
          currentName={active?.name ?? ''}
          configurationsNames={configurations.map((c) => c?.name)}
          onClose={closeConfigRenameModal}
          handleRenameConfiguration={(newName) =>
            renameConfiguration(active?.name, newName)
          }
        />

        <ConfirmModal
          isOpen={isConfigDeleteModalOpen}
          onClose={closeConfigDeleteModal}
          onConfirm={handleRemoveConfiguration}
        >
          <Text size="sm" data-testid="config-delete-confirmation-text">
            Are you sure you want to delete the configuration?
          </Text>
        </ConfirmModal>

        <PreferenceModal
          isOpen={isTemplateModalOpen}
          titleModal="Template folders"
          contentComponent={
            <TemplateModalContent
              isSavingTemplatePreferences={isSavingTemplatePreferences}
              setIsSavingTemplatePreferences={setIsSavingTemplatePreferences}
              closeTemplateModal={closeTemplateModal}
            />
          }
          onClose={closeTemplateModal}
          handleSavePreferences={() => {
            setIsSavingTemplatePreferences(true);
          }}
        />

        <VisualizationURIModal
          opened={isAddTreeModalOpen}
          close={closeAddTreeModal}
        />
      </AppShell.Main>
    </AppShell>
  );
}
