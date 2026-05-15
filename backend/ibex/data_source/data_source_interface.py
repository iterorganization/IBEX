"""Interface for all data sources"""

from abc import ABC, abstractmethod
from typing import Sequence, Optional, List


class DataSourceInterface(ABC):
    @abstractmethod
    def data_serializer_custom(self, obj):
        """
        Custom data sub-serializer. Replaces arbitrary objects with ones supported by ORJSON serializer (IDSNumericArray -> np.array).
        """
        ...

    @abstractmethod
    def data_entry_exists(self, uri: str) -> bool:
        """
        Check if data entry can be opened

        :param uri: imas URI
        :return: True if entry can be opened, False otherwise
        """
        ...

    @abstractmethod
    def list_idses(self, uri: str) -> dict:
        """
        Returns list of IDSes with occurrence numbers that are filled in given data entry uri

        :param uri: imas URI
        :return: dictionary: {'idses': [{'name':<name>, 'occurrences':[<0>,<1>,...]}, {'name': ...}]}
        """
        ...

    @abstractmethod
    def get_node_info(
        self,
        uri: str,
        ids: str,
        node_path: str,
        occurrence: int = 0,
        recursive: bool = False,
        show_error_bars: bool = False,
    ) -> dict:
        """
        Returns dictionary with basic info about IDS node pointed by `node_path` argument

        :param uri: pulsefile uri - used only to get proper DD version
        :param ids: name of ids e.g. core_profiles
        :param node_path: path to ids node e.g. ids_properties/version_put
        :param occurrence: ids occurrence number
        :param recursive: if True, creates node_info tree. If False, returns only pointed node and it's children node_info
        :param show_error_bars: whether error bar nodes should be returned, or not
        :return:
        """
        ...

    @abstractmethod
    def get_data(self, uri: str, ids: str, node_path: str, occurrence: int = 0, downsampling_method: str | None = None, downsampled_size: int = 1000,) -> dict:
        """
        Returns data extracted from IDS, converted into dictionary

        :param uri: imas URI
        :param ids: name of ids e.g. core_profiles
        :param node_path: path to ids node e.g. ids_properties/version_put
        :param occurrence: ids occurrence number
        :param downsampling_method: method to be used during downsampling process
        :param downsampled_size: target size for downsampling
        :return: dictionary {'value':<node_value>}, where <node_value> represents data extracted from IDS node
        """
        ...

    @abstractmethod
    def find_paths(self, uri: str, ids: str, searched_node: str, occurrence: int = 0) -> dict:
        """
        Finds paths containing phrase passed in searched_node argument

        :param uri: imas URI
        :param ids: name of ids e.g. core_profiles
        :param searched_node: searched text
        :param occurrence: ids occurrence number
        :return: dictionary {'paths': ['path/to/node1','path/to/node2', ...]}
        """
        ...

    @abstractmethod
    def array_summary(self, uri: str, ids: str, node_path: str, occurrence: int = 0) -> dict:
        """
        Returns short summary of array node as a dictionary

        :param uri: imas URI
        :param ids: name of ids e.g. core_profiles
        :param node_path: path to ids node e.g. ids_properties/version_put
        :param occurrence: ids occurrence number
        :return: dictionary {'shape': [<dim1>,<dim2>, ...], 'min':<min_value>, 'max':<max_value>, 'mean':<mean>, 'standard_deviation':<s_d>}
        """
        ...

    @abstractmethod
    def list_db_entries(
        self,
        user: str,
        backends: Optional[Sequence[str]] = None,
        database: Optional[str] = None,
        version: Optional[int] = None,
    ) -> dict:
        """
        Returns list of available data entries

        :param user: owner of searched data entry
        :param backends: searched backends [<be1>, <be2>, ...]: default(None)
        :param database: searched database name: default(None)
        :param version: searched AL major version:
        :return: dictionary {'entries': [<uri1>, <uri2>, ...]}
        """
        ...

    def get_plot_data(
        self,
        uri: str,
        ids: str,
        node_path: str,
        occurrence: int = 0,
        interpolate_over: List[str] | None = None,
        interpolation_method: str | None = None,
        downsampling_method: str | None = None,
        downsampled_size: int = 1000,
    ) -> dict:
        """
        Returns all data used to plot selected quantity. Result contains data values, metadata and coordinates.

        :param uri: imas URI
        :param ids: name of ids e.g. core_profiles
        :param node_path: path to ids node e.g. ids_properties/version_put
        :param occurrence: ids occurrence number
        :param interpolate_over: list of uris used in interpolation
        :param interpolation_method: method to be used in data interpolation; one from scipy.interpolate.RegularGridInterpolator or 'exact_value'
        :param downsampling_method: one of the downsampling metods returend by :func:`~ibex.endpoints.info.downsampling_methods` endpoint, or None
        :param downsampled_size: target size of downsampled data
        :return: Dictionary containing data values, metadata and coordinates.
        """
        ...
