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
} from '../types';
import { ConfigCreateModal, ConfirmModal, Header } from '../components';
import { PreferenceModal } from '../components/preferences/PreferenceModal';
import {
  updateIbexConfig,
  formatConfigBeforeLoadingURIs,
  plotNodeUriLoaded,
  updateCustomDataTree,
  readIbexConfig,
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

  const handleSaveConfiguration = async () => {
    const dataGridWithoutData: DataGridPlotToSave[] = active.dataPlot.map(
      (dataGrid: DataGridPlot): DataGridPlotToSave => ({
        title: dataGrid.title,
        isTitleOverwritten: dataGrid.isTitleOverwritten,
        displayErrorBand: dataGrid.displayErrorBand,
        displayGrid: dataGrid.displayGrid,
        downsampled_method: dataGrid?.downsampled_method,
        downsampled_size: dataGrid?.downsampled_size,
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
              path: coord.path,
              target: coord.target,
              valueIndex: coord.valueIndex,
              range: coord?.range,
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
          };
        }),
      }),
    );

    // Remove ' (x)' at the end of the name if there has been name duplicates during configuration load
    const correctedName = active.name.replace(/\s*\(\d+\)$/, '');
    let savedConfig = false;

    const newIbexState: ConfigurationToSave = {
      name: correctedName,
      dataURI: active.dataURI,
      lastURIInput: active.lastURIInput,
      lastLocalDataSetSelected: active.lastLocalDataSetSelected,
      dataPlot: dataGridWithoutData,
    };
    if (active?.path) {
      await window.api.fs.writeFile(
        active.path,
        JSON.stringify(newIbexState, null, 2),
      );
      savedConfig = true;
    } else {
      await window.api.fs
        .saveAsDialog(`${active.name}IbexState.json`, 'json')
        .then((path: string) => {
          if (path) {
            active.path = path;
            window.api.fs.writeFile(
              path,
              JSON.stringify(newIbexState, null, 2),
            );
            savedConfig = true;
          }
        });
    }

    const updateActive: Configuration = {
      ...active,
      saved: savedConfig,
    };

    updatedConfiguration(updateActive);
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

    await window.api.fs.readFile(path).then(async (data: string) => {
      const newIbexState: ConfigurationToSave = JSON.parse(data);

      const configurationNameAlreadyExists = configurations.some((value) => {
        if (value.name == newIbexState.name) return true;
      });

      if (configurationNameAlreadyExists) {
        const configurationAlreadyLoaded = configurations.some((value) => {
          if (value.path == path) return true;
        });

        if (configurationAlreadyLoaded) {
          showNotification({
            title: 'Configuration already loaded',
            message: `The configuration ${newIbexState.name} is already loaded.`,
            color: 'yellow',
          });
          return;
        }

        // We have a duplicate configuration name
        // We will add a (x) to the name until there is no name duplicate in the configuration list
        let offsetName = 1;
        let newConfigurationName = newIbexState.name;
        while (
          configurations.some((value) => {
            if (value.name == newConfigurationName) return true;
          })
        ) {
          newConfigurationName = newIbexState.name + ` (${offsetName})`;
          offsetName++;
        }

        newIbexState.name = newConfigurationName;
      }

      const newListDataGridPlot = formatConfigBeforeLoadingURIs(newIbexState);
      const newConfig: Configuration = {
        name: newIbexState.name,
        dataURI: newIbexState.dataURI,
        customDataTree: updateCustomDataTree([], newIbexState.dataURI),
        checkedNodeURI: [],
        dataPlot: await plotNodeUriLoaded(newListDataGridPlot),
        saved: true,
        path: path,
      };

      addConfiguration(newConfig);
      setActive(newConfig.name);
    });
  };

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

    loadDefaultConfiguration();
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
          handleSaveConfiguration={handleSaveConfiguration}
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
