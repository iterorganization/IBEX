import { useState } from 'react';
import { DataGridPlot, GeometryInfos } from '../../../types';
import { MultiSelect, Select, Stack } from '@mantine/core';
import { useIbexStore } from '../../../stores';
import { fetchGeometries, formatGeometriesToSave } from '../../../utils';
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
          customizedDataGrid.geometrie,
          active.dataURI,
        ).map((geo) => geo.geometryUri),
      ),
    ];
  });

  const handleSelectedUri = (value: string) => {
    setSelectedUri(value);
    // TODO : call BE endpoint to get geometries and fill multiselect data
    const rawData: GeometryInfos[] = [
      {
        geometryUri: 'URI-0#wall/description_2d[:]/limiter/unit[:]/outline/',
        parameters: ['r', 'z'],
      },
      {
        geometryUri: 'URI-0#pf_active:0/coil[:]/element[:]/geometry/',
        parameters: [
          'rectangle/r',
          'rectangle/z',
          'rectangle/width',
          'rectangle/height',

          'oblique/r',
          'oblique/z',
          'oblique/length_alpha',
          'oblique/length_beta',
          'oblique/alpha',
          'oblique/beta',
        ],
      },
    ];
    setGeometriesAvailable(rawData);
    setGeometriesSelectable(rawData?.map((d) => d.geometryUri));
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
      customizedDataGrid.geometrie = [];
    } else {
      if (values.length < selectedGeometries.length) {
        // Remove selected geometry
        const selectUriToRemove = selectedGeometries.find(
          (value) => !values.includes(value),
        ); // Get selected geometrie
        const uri = active.dataURI.find(
          (uri) => uri.name === selectUriToRemove.split('#')[0],
        )?.uri;
        const pathToRemove = '#' + selectUriToRemove.split('#')[1];
        const fullPathToRemove = uri + pathToRemove;
        customizedDataGrid.geometrie = customizedDataGrid.geometrie.filter(
          (geoToRemove) => !geoToRemove.geometryUri.includes(fullPathToRemove),
        );
      } else if (values.length > selectedGeometries.length) {
        // Add selected geometry
        const added =
          '#' +
          values
            .find((value) => !selectedGeometries.includes(value))
            .split('#')[1]; // Get selected geometrie

        const wantedGeometryInfos: GeometryInfos = geometriesAvailable.find(
          (geo) => geo.geometryUri.includes(added),
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

        customizedDataGrid.geometrie = fetchedGeometrie.geometrie;
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
