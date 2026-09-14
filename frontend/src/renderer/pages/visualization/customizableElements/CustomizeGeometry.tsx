import { useState } from 'react';
import { DataGridPlot, GeometryInfos } from '../../../types';
import { MultiSelect, Select, Stack } from '@mantine/core';
import { useIbexStore } from '../../../stores';
import {
  fetchGeometries,
  fetchGeometryNodes,
  formatGeometriesToSave,
} from '../../../utils';
import { showNotification } from '@mantine/notifications';

interface CustomizeGeometryProps {
  customizedDataGrid: DataGridPlot;
  setCustomizedDataGrid: React.Dispatch<React.SetStateAction<DataGridPlot>>;
}
export const CustomizeGeometry = ({
  customizedDataGrid,
  setCustomizedDataGrid,
}: CustomizeGeometryProps) => {
  const { active } = useIbexStore();
  const [selectedUri, setSelectedUri] = useState<string>(null);
  const [geometriesAvailable, setGeometriesAvailable] = useState<
    GeometryInfos[]
  >([]);
  const [geometriesSelectable, setGeometriesSelectable] = useState<string[]>(
    [],
  );
  const [selectedGeometries, setSelectedGeometries] = useState<string[]>(() => {
    return [
      ...new Set(
        formatGeometriesToSave(
          customizedDataGrid.geometries,
          active.dataURI,
        ).map((geo) => geo.geometry_node),
      ),
    ];
  });

  const handleSelectedUri = async (value: string) => {
    if (!value) {
      return;
    }
    setSelectedUri(value);

    // Call BE endpoint to get geometries and fill multiselect data
    const labelUri = active.dataURI.find((d) => d.uri === value)?.name || '';
    const geometryNode = await fetchGeometryNodes(value, labelUri);

    setGeometriesAvailable(geometryNode);
    setGeometriesSelectable(geometryNode?.map((d) => d.geometry_node));
  };

  /**
   * Update geometry list
   * @param values - selected paths
   */
  const handleSelectGeometrie = async (values: string[]) => {
    // Control the coordinates order to prevent from adding geometry when coordinates are incompatible with geometries
    if (
      !(
        customizedDataGrid.coordinates.length >= 2 &&
        (customizedDataGrid.coordinates[0].axeIndex === 0 ||
          customizedDataGrid.coordinates[0].axeIndex === 1) &&
        (customizedDataGrid.coordinates[1].axeIndex === 0 ||
          customizedDataGrid.coordinates[1].axeIndex === 1)
      )
    ) {
      console.warn(
        'Axis are not matching with geometries: the default axis should be restored to get geometries.',
      );
      showNotification({
        title: 'Axis are not matching with geometries',
        message: 'The default axis should be restored to get geometries.',
        color: 'yellow',
      });
      return;
    }

    const checkedNodeURI = structuredClone(active.checkedNodeURI);

    if (!values.length) {
      // Remove all geometries
      customizedDataGrid.geometries = [];
    } else {
      if (values.length < selectedGeometries.length) {
        // Remove selected geometry
        const selectUriToRemove = selectedGeometries.find(
          (value) => !values.includes(value),
        ); // Get selected geometries
        const uri = active.dataURI.find(
          (uri) => uri.name === selectUriToRemove.split('#')[0],
        )?.uri;
        const pathToRemove = '#' + selectUriToRemove.split('#')[1];
        const fullPathToRemove = uri + pathToRemove;
        customizedDataGrid.geometries = customizedDataGrid.geometries.filter(
          (geoToRemove) =>
            !geoToRemove.geometry_node.includes(fullPathToRemove),
        );
      } else if (values.length > selectedGeometries.length) {
        // Add selected geometry
        const added =
          '#' +
          values
            .find((value) => !selectedGeometries.includes(value))
            .split('#')[1]; // Get selected geometries

        const wantedGeometryInfos: GeometryInfos = geometriesAvailable.find(
          (geo) => geo.geometry_node.includes(added),
        );

        // Get geometries
        const fetchedGeometrie = await fetchGeometries(
          selectedUri + added,
          customizedDataGrid,
          checkedNodeURI,
          wantedGeometryInfos,
        );

        if (!fetchedGeometrie) {
          // Prevent from displaying contour plot when no geometry are available
          showNotification({
            title: 'No geometry available',
            message: 'No geometry to display.',
            color: 'yellow',
          });
          return;
        }

        customizedDataGrid.geometries = fetchedGeometrie.geometries;
      }
    }
    setCustomizedDataGrid({
      ...customizedDataGrid,
    });

    setSelectedGeometries(...[values]);
  };

  return (
    <Stack w="fit-content">
      <Select
        w={300}
        maxDropdownHeight={200}
        label="URI containing geometries"
        placeholder="Pick a URI"
        data={active.dataURI?.map((d) => d.uri)}
        value={selectedUri}
        onChange={handleSelectedUri}
        searchable
        nothingFoundMessage="Nothing found..."
      />
      <MultiSelect
        w={300}
        maxDropdownHeight={200}
        label="Geometries to display"
        placeholder="Pick a geometry"
        data={geometriesSelectable}
        value={selectedGeometries}
        onChange={(values) => handleSelectGeometrie(values)}
        searchable
        nothingFoundMessage="Nothing found..."
      />
    </Stack>
  );
};
