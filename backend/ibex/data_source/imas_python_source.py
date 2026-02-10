"""IMAS-Python data source - default for IBEX"""

from typing import Optional, Sequence, List

import imas  # type: ignore
import numpy as np  # type: ignore
import re  # type: ignore
from idstools.database import DBMaster  # type: ignore
from imas.ids_metadata import IDSMetadata  # type: ignore
from imas.ids_primitive import (
    IDSNumericArray,
    IDSString0D,
    IDSString1D,
    IDSComplex0D,
    IDSFloat0D,
    IDSInt0D,
    IDSPrimitive,
)  # type: ignore
from imas.ids_struct_array import IDSStructArray  # type: ignore
from imas.ids_structure import IDSStructure  # type: ignore
from imas.ids_data_type import IDSDataType  # type: ignore
from imas.ids_base import IDSBase  # type: ignore
from imas.ids_path import IDSPath  # type: ignore

from itertools import zip_longest, chain  # type: ignore

from imas_core.exception import ImasCoreBackendException

from ibex.data_source.data_source_interface import DataSourceInterface
from ibex.data_source.exception import (
    NodeNotFoundException,
    IdsNotFoundException,
    NotALeafNodeException,
    NotAnArrayException,
    EntryNotFoundException,
    NoDataException,
    InvalidParametersException,
)
from ibex.core.utils import downsample_data, transform_2D_data, find_first_value_in_list


class IMASPythonSource(DataSourceInterface):
    """
    Default data_source for IBEX
    """

    def __init__(self):
        """
        Default constructor
        """
        ...

    def data_serializer_custom(self, obj):
        """
        Custom data sub-serializer. Replaces arbitrary objects with ones supported by ORJSON serializer (IDSNumericArray -> np.array).
        """
        if isinstance(obj, IDSPrimitive):
            return obj.value
        if isinstance(obj, np.ndarray) and not obj.flags.c_contiguous:
            return np.ascontiguousarray(obj)
        raise TypeError

    def _open_entry(self, uri: str) -> imas.DBEntry:
        """
        Opens DBEntry with mode "r". Handles possible exceptions.

        :param uri: imas URI
        :return: DBEntry object
        """
        try:
            return imas.DBEntry(uri, mode="r")
        except ImasCoreBackendException:
            message = f"Could not open pulsefile: {uri}"
            raise EntryNotFoundException(message) from None

    def _get_ids_from_entry(self, entry: imas.DBEntry, ids: str, occurrence: int = 0):
        """
        Reads ids from already opened DBEntry. Handles possible exceptions.

        :param entry: imas.DBEntry
        :param ids: name of ids e.g. core_profiles
        :param occurrence: ids occurrence number
        :return: IDSBase object
        """
        try:
            ids_root = entry.get(ids, lazy=True, autoconvert=False, occurrence=occurrence)
            return ids_root
        except imas.exception.IDSNameError as e:
            raise IdsNotFoundException(e) from None

    def data_entry_exists(self, uri: str) -> bool:
        """
        Check if data entry can be opened

        :param uri: imas URI
        :return: True if entry can be opened, False otherwise
        """

        try:
            entry = self._open_entry(uri)
            entry.close()
        except EntryNotFoundException:
            return False
        return True

    def list_idses(self, uri: str) -> dict:
        """
        Returns list of IDSes with occurrence numbers that are filled in given data entry uri

        :param uri: imas URI
        :return: dictionary: {'idses': [{'name':<name>, 'occurrences':[<0>,<1>,...]}, {'name': ...}]}
        """

        entry = self._open_entry(uri)
        ids_list = entry.factory.ids_names()
        result: dict = {"idses": []}

        # if "/uda?" in uri:
        #    return result

        for ids_name in ids_list:
            filled_occurrences = entry.list_all_occurrences(ids_name=ids_name)
            # filled_occurrences contains numpy.int32 types that have to be converted into int
            filled_occurrences = list(map(int, filled_occurrences))
            if filled_occurrences:
                result["idses"].append({"name": ids_name, "occurrences": filled_occurrences})

        entry.close()
        return result

    def _jsonify_metadata(self, metadata: IDSMetadata, recursive: bool = False, show_error_bars: bool = False) -> dict:
        """
        Converts imas.ids_metadata.IDSMetadata into dictionary

        :param metadata: imas.ids_metadata.IDSMetadata - metadata to be converted
        :param recursive: if it should append recursively metadata of children, children of children and so on...
        :param show_error_bars: whether error bar nodes should be returned, or not
        :return: metadata turned into dictionary with keys: `name`:str, `type`:str, `ndim`:str, `shape`:str, `children`:list[dict]
        """

        result = {}
        result["name"] = metadata.name
        result["type"] = metadata.data_type or "structure"
        result["ndim"] = metadata.ndim
        result["shape"] = []  # empty for 0D data

        if recursive:
            result["children"] = [self._jsonify_metadata(child, recursive) for child in metadata]
        else:
            result["children"] = [
                {"name": child.name, "type": child.data_type, "ndim": child.ndim}
                for child in metadata
                if show_error_bars or not any(x in child.name for x in ["_error_upper", "_error_lower", "_error_index"])
            ]

        return result

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
        :param recursive: If True, creates node_info tree. If False, returns only pointed node and it's children node_info
        :param show_error_bars: whether error bar nodes should be returned, or not
        :return: dictionary containing node metadata
        """

        with self._open_entry(uri) as entry:
            metadata, coordinates = self._get_metadata_and_coordinates(entry, ids, node_path, occurrence)
            metadata_dict = self._jsonify_metadata(metadata, recursive, show_error_bars)

            # coordinates key contains list of lists of strings
            metadata_dict["coordinates"] = list(coordinates.values())
            # flatten list
            metadata_dict["coordinates"] = list(chain.from_iterable(metadata_dict["coordinates"]))

            # fill 'shape', but omit it if path points to more than one node
            if metadata_dict["ndim"] > 0 and ":" not in node_path:
                ids_path = IDSPath(node_path)
                path_elements = list(ids_path.items())
                ids_obj = self._get_ids_from_entry(entry, ids, occurrence)
                data_nodes = self._get_raw_data(ids_obj, path_elements)

                target_node = data_nodes
                # traverse through data until you find value
                while isinstance(target_node, list):
                    target_node = target_node[0]

                if isinstance(target_node, IDSStructure):
                    return metadata_dict

                if metadata_dict["type"] == IDSDataType.STRUCT_ARRAY or metadata_dict["type"] == IDSDataType.STR:
                    metadata_dict["shape"] = [len(target_node)]
                else:  # Numeric array
                    metadata_dict["shape"] = target_node.shape

        return metadata_dict

    def _get_raw_data(self, ids_obj: IDSBase, path_elements: List[IDSPath] | None):
        """
        Internal function. Returns raw data extracted from IDS

        :param ids_obj: root element used to traverse path
        :param path_elements: list of paths from root to leaf e.g. [IDSPath("ids_properties"), IDSPath("version_put"), IDSPath("access_layer")]
        :return: value, or list of values depending on context. Could be int, str, np.ndarray, complex, IDSStructure, etc.
        """

        if len(path_elements) == 0:
            # exit recursion
            return ids_obj

        # path_elements contains list of pairs (node_name, node_index/slice)
        # path_elements[0] represents first element of path
        # e.g. in path `profiles_1d[2]/t_i_average` path_elements[0] is tuple ('profiles_1d', 2)

        # There are 3 possible values of path index:
        # - None (no index at all e.g. in 'ids_properties')
        # - int value (single index e.g. in 'profiles_1d[2]')
        # - slice (range of values e.g. in 'profiles_1d[5:10]')

        path_node_name = path_elements[0][0]
        path_index = path_elements[0][1]

        if path_index is None:
            # No index in path element, just go deeper with recursion
            try:
                new_ids_obj = ids_obj[path_node_name]
            except AttributeError as e:
                raise NodeNotFoundException(e)
            return self._get_raw_data(new_ids_obj, path_elements[1:])

        elif isinstance(path_index, int):
            # int index in path element, just go deeper with recursion using index
            try:
                new_ids_obj = ids_obj[f"{path_node_name}[{path_index}]"]
            except AttributeError as e:
                raise NodeNotFoundException(e)
            return self._get_raw_data(new_ids_obj, path_elements[1:])

        elif isinstance(path_index, slice):
            # slice index in path element
            # here recursive tree splits into another branches. Then all returned values are put into single list.
            try:
                new_ids_obj = ids_obj[f"{path_node_name}"]
            except AttributeError as e:
                raise NodeNotFoundException(e)

            # === Evaluate start, stop and step parameters ===
            slice_obj = path_index

            start = slice_obj.start if slice_obj.start else 0
            if slice_obj.stop:
                stop = slice_obj.stop
            else:
                stop = len(new_ids_obj)

            step = slice_obj.step if slice_obj.step else 1
            # === ===

            # === Extract values ===
            result = []
            for x in range(start, stop, step):
                result.append(self._get_raw_data(new_ids_obj[x], path_elements[1:]))
            return result
        else:
            raise Exception(
                f"Type {type(path_index)} slices are not supported. Unsupported slice was found in {path_elements[0]} path part"
            )

    def _slice_to_string(self, slice_obj: slice | None | int):
        """
        Coverts slice object into it's string representation e.g. slice(1,2,3) -> [1:2:3]

        :param slice_obj: slice object
        :return: string representation of slice
        """
        if slice_obj is None:
            return ""
        if not isinstance(slice_obj, slice):
            # str, int, etc.
            return f"[{slice_obj}]"

        start = str(slice_obj.start) if slice_obj.start else ""
        stop = str(slice_obj.stop) if slice_obj.stop else ""
        step = str(slice_obj.step) if slice_obj.step else ""

        if not step:
            return f"[{start}:{stop}]"
        elif not start:
            return f"[:{stop}:{step}]"
        elif not stop:
            return f"[{start}::{step}]"
        else:
            return f"[{start}:{stop}:{step}]"

    def _get_path_and_path_ancestors(self, node_path: IDSPath):
        """
        Returns list of path and it's ancestors

        :param node_path: node_path
        :return: list of path and ancestors
        """

        # =========== Extract path ancestors ===========
        path_elements: List[str] = [f"{x[0]}{self._slice_to_string(x[1])}" for x in node_path.items()]

        # contains IDSPaths of all ancestors of path + path itself
        ancestors_and_path = []
        for i in range(1, len(path_elements) + 1):
            ancestors_and_path.append(IDSPath("/".join(path_elements[:i])))

        # sort list to contain leaf nodes at the beginning
        ancestors_and_path.sort(key=lambda x: len(str(x)), reverse=True)

        return ancestors_and_path

    def _get_metadata_and_coordinates(
        self, entry: imas.DBEntry, ids: str, node_path: str, occurrence: int = 0
    ) -> (IDSMetadata, List[str]):
        """
        Returns metadata of node and coordinates of node and it's ancestors

        :param entry: IMAS.DBEntry - used only to get proper DD version
        :param ids: name of ids e.g. core_profiles
        :param node_path: path to ids node e.g. ids_properties/version_put
        :param occurrence: ids occurrence number
        :return: tuple(IDSMetadata, dict(k: <node_name>, v: <coordinate_node_name>))
        """

        ids_obj = self._get_ids_from_entry(entry, ids, occurrence)

        is_time_homogeneous = ids_obj.ids_properties.homogeneous_time.value

        data_path = IDSPath(node_path)
        try:
            node_metadata = data_path.goto_metadata(ids_obj.metadata)
        except ValueError as e:
            raise NodeNotFoundException(e) from None
        ancestors_and_path = self._get_path_and_path_ancestors(data_path)

        # dict "node" : "coordinate"
        # e.g "profiles_1d[:]" : "time"
        coordinates = {}
        for element in ancestors_and_path:
            element_metadata = element.goto_metadata(ids_obj.metadata)

            # replace time-based coordinates with generic "time", if time is homogeneous
            for coord in element_metadata.coordinates:
                if element not in coordinates:
                    coordinates[element] = []

                if is_time_homogeneous and bool(coord.is_time_coordinate):
                    coordinates[element].append("time")
                else:
                    coordinates[element].append(str(coord))
        return (node_metadata, coordinates)

    def get_data(
        self,
        uri: str,
        ids: str,
        node_path: str,
        occurrence: int = 0,
        downsampling_method: str | None = None,
        downsampled_size: int = 1000,
        range: List[int] | None = None,
    ) -> dict:
        """
        Returns data extracted from IDS, converted into dictionary

        :param uri: imas URI
        :param ids: name of ids e.g. core_profiles
        :param node_path: path to ids node e.g. ids_properties/version_put
        :param occurrence: ids occurrence number
        :param range:
        :return: dictionary {'value':<node_value>}, where <node_value> represents data extracted from IDS node
        """

        with self._open_entry(uri) as entry:
            ids_root = self._get_ids_from_entry(entry, ids, occurrence)

            ids_path = IDSPath(node_path)
            path_elements = list(ids_path.items())
            ids_data = self._get_raw_data(ids_root, path_elements)
        self._check_data_is_leaf_node(ids_data)

        data_to_be_returned = ids_data

        first_value = ids_data
        while isinstance(first_value, list):
            first_value = first_value[0]

        self._replace_empty_numbers(data_to_be_returned)
        if self._is_empty(data_to_be_returned):
            raise NoDataException(f"No data for {node_path}")

        try:
            if first_value.metadata.ndim == 1 and downsampling_method is not None:
                _, data_to_be_returned = downsample_data(
                    data=data_to_be_returned, target_size=downsampled_size, method=downsampling_method
                )
        except BaseException as e:
            raise InvalidParametersException(f"Downsampling failed: {e}") from None

        return {"value": data_to_be_returned}

    def _add_index_to_aos_in_path(self, ids_metadata: imas.ids_base.IDSBase, path_str: str):
        """
        Helper function to add `[:]` to AoSs in path:
        eg: source/profiles_1d/time -> source[:]/profiles_1d[:]/time (core_sources)

        :param ids_metadata: root of metadata path refers to
        :param path_str: path string
        :return: reworked string path
        """
        path_elements = path_str.split("/")
        result = ""

        for element in path_elements:
            ids_path = IDSPath(element)
            ids_metadata = ids_path.goto_metadata(ids_metadata)

            result += element
            if ids_metadata.data_type == IDSDataType.STRUCT_ARRAY:
                result += "[:]"
            result += "/"

        # return result without unnecessary "/" at the end
        return result[:-1]

    def find_paths(self, uri: str, searched_node: str, show_error_bars: bool = False) -> dict:
        """
        Finds paths containing phrase passed in searched_node argument

        :param uri: imas URI
        :param searched_node: searched text
        :param show_error_bars: whether error bar nodes should be returned, or not
        :return: dictionary {'paths': ['path/to/node1','path/to/node2', ...]}
        """
        with self._open_entry(uri) as entry:
            found_paths = []
            ids_list = entry.factory.ids_names()

            for ids in ids_list:
                try:
                    ids_obj = entry.get(ids, occurrence=0, autoconvert=False, lazy=True)
                    paths = [node for node in imas.util.find_paths(ids_obj, searched_node)]
                    for path in paths:
                        if not show_error_bars and any(
                            error_node in path for error_node in ["_error_upper", "_error_lower", "_error_index"]
                        ):
                            continue

                        # collect only leaf nodes
                        node_data_type = ids_obj.metadata[path].data_type
                        if node_data_type.value != "structure" and node_data_type.value != "struct_array":
                            found_paths.append(f"#{ids}/{self._add_index_to_aos_in_path(ids_obj.metadata, path)}")

                except imas.exception.DataEntryException:
                    continue

        return {"paths": found_paths}

    def array_summary(self, uri: str, ids: str, node_path: str, occurrence: int = 0) -> dict:
        """
        Returns short summary of array node as a dictionary

        :param uri: imas URI
        :param ids: name of ids e.g. core_profiles
        :param node_path: path to ids node e.g. ids_properties/version_put
        :param occurrence: ids occurrence number
        :return: dictionary {'shape': [<dim1>,<dim2>, ...], 'min':<min_value>, 'max':<max_value>, 'mean':<mean>, 'standard_deviation':<s_d>}
        """
        if "[:]" in node_path:
            message = "Array summary supports only single leaf node, not tensorized AoS (path with ':')"
            raise InvalidParametersException(message)

        ids_path = IDSPath(node_path)
        path_elements = list(ids_path.items())

        with self._open_entry(uri) as entry:
            ids_obj = self._get_ids_from_entry(entry, ids, occurrence)
            ids_data = self._get_raw_data(ids_obj, path_elements)
        self._check_data_is_leaf_node(ids_data)

        if isinstance(ids_data, IDSStructure) or isinstance(ids_data, IDSStructArray):
            raise NotALeafNodeException(f"Path {node_path} does not point to a leaf node")

        if not isinstance(ids_data, IDSNumericArray):
            raise NotAnArrayException("Cannot get array summary of non array node")

        result = {}

        result["shape"] = ids_data.shape
        result["min"] = np.min(ids_data)
        result["max"] = np.max(ids_data)
        result["mean"] = np.mean(ids_data)
        result["standard_deviation"] = np.std(ids_data)

        return result

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

        result: dict[str, list[str]] = {}
        result["entries"] = []

        try:
            dbs = DBMaster.get_database_files(user, database, version, backends)
        except FileNotFoundError as e:
            raise InvalidParametersException(e)

        # Part of IDStools dblist script
        for dbname, dvs in dbs:
            if database and database not in dbname:
                continue
            for dv, dbbackends in dvs:
                if version and dv != version:
                    continue
                for backend, dbs in dbbackends:
                    if backends and backend not in backends:
                        continue
                    for pulse, runs in sorted(dbs.items()):
                        for r in sorted(runs, key=lambda x: x[1]):
                            result["entries"].append(
                                f"imas:{backend.lower()}?user={user};pulse={pulse};"
                                f"run={r[1]};database={dbname};version={dv}"
                            )
        return result

    def _extract_1_N_coord_values(self, data):
        """
        Goes through list of IDSStructArray (or lists of lists of lists...) and returns all 1...N coordinates values

        :param data: flat or nested list of IDSStructArray
        :return: list of 1...N values. Has the same shape as input list
        """
        if isinstance(data, list):
            return [self._extract_1_N_coord_values(x) for x in data]
        else:
            return data.coordinates[0]

    def _check_data_is_leaf_node(self, data) -> None:
        """
        Helper function. Helps determine if data could be returned (e.g. is not IDSStructure).
        It has to be done before data is returned to serializer.
        """
        if isinstance(data, list):
            for x in data:
                self._check_data_is_leaf_node(x)
        elif isinstance(data, IDSStructure):
            raise NotALeafNodeException("Cannot serialize non-leaf node")

    def get_plot_data(
        self,
        uri: str,
        ids: str,
        node_path: str,
        occurrence: int = 0,
        downsampling_method: str | None = None,
        downsampled_size: int = 1000,
    ):
        """
        Returns all data used to plot selected quantity. Result contains data values, metadata and coordinates.

        :param uri: imas URI
        :param ids: name of ids e.g. core_profiles
        :param node_path: path to ids node e.g. ids_properties/version_put
        :param occurrence: ids occurrence number
        :return: Dictionary containing data values, metadata and coordinates.
        """

        with self._open_entry(uri) as entry:
            ids_obj = self._get_ids_from_entry(entry, ids, occurrence)

            ids_path = IDSPath(node_path)
            path_elements = list(ids_path.items())
            ids_data = self._get_raw_data(ids_obj, path_elements)
            self._check_data_is_leaf_node(ids_data)

            if self._is_empty(ids_data):
                raise NoDataException(f"No data for {node_path}")
            coordinates_to_be_returned = []

            # =================================
            metadata, coordinates_dict = self._get_metadata_and_coordinates(entry, ids, node_path, occurrence)
            # replace all dummy indexes i.e. "itime", "i1", "i2", "i3"... -> [<value_from_target_node>]
            for _node_path, _coordinate_path_list in coordinates_dict.items():
                _new_coordinate_path_list = []
                for _coordinate_path in _coordinate_path_list:
                    if _coordinate_path == "1...N":
                        _new_coordinate_path_list.append("1...N")
                        continue

                    _new_coordinate_path = ""

                    # iterate over path elements. X stands target node path element, while Y stands for coordinate path elements
                    # we do this in order to fill dummy indexes with indexes extracted from target node path
                    for x, y in zip_longest(_node_path.items(), IDSPath(_coordinate_path).items()):
                        # x[0] is node name in path eg. profiles_1d
                        # x[1] is indices or single index. For instance x=profiles_1d[123] -> x[0]=profiles_1d & x[1]=123
                        # the same applies to y

                        y_indices = y[1] if y is not None else None

                        if y is not None:
                            if x is not None and x[0] == y[0]:
                                y_indices = x[1]
                            # construct new coordinate path element from node_name and slice extracted from x[1]
                            _new_coordinate_path += f"{y[0]}{self._slice_to_string(y_indices)}/"

                    # delete last "/" from path
                    _new_coordinate_path = _new_coordinate_path[:-1]

                    _new_coordinate_path_list.append(_new_coordinate_path)
                coordinates_dict[_node_path] = _new_coordinate_path_list

            # =================================
            for target, coord_list in coordinates_dict.items():
                # certain coordinate has influence on final data shape only if it is a slice (e.g. profiles_1d[:]), or a leaf node
                # search for [<number>] in coordinate target
                shapes_dimension = not bool(re.search(r"\[\d+\]$", str(target)))

                for coord in coord_list:
                    if coord == "1...N":
                        # 1...N coords are targeting AoS
                        # remove last array operator ([<number or colon>]) from path and save it as target_str

                        splitted_target = str(target).split("/")
                        splitted_target[-1] = re.sub(r"[\[\(](.*?)[\]\)]", "", splitted_target[-1])
                        target_str = "/".join([x for x in splitted_target])
                        # ====================================

                        ids_path = IDSPath(str(target_str))
                        path_elements = list(ids_path.items())
                        coord_target_objects = self._get_raw_data(ids_obj, path_elements)
                        self._check_data_is_leaf_node(coord_target_objects)

                        # collect labels for 1...N coordinates
                        labels = []
                        try:
                            for element in coord_target_objects:
                                if hasattr(element, "name"):
                                    labels.append(str(element.name))
                                elif hasattr(element, "label"):
                                    labels.append(str(element.label))
                                elif hasattr(element, "identifier") and hasattr(element.identifier, "name"):
                                    labels.append(str(element.identifier.name))
                                elif hasattr(element, "type") and hasattr(element.type, "name"):
                                    labels.append(str(element.type.name))
                                else:
                                    raise AttributeError("No additional data to create label")

                            # if any label is empty, use indexes instead
                            if any(s == "" for s in labels):
                                labels = []
                        except AttributeError:
                            labels = []

                        coord_values: np.ndarray = self._extract_1_N_coord_values(coord_target_objects)

                        # ==================================== find and add shape factors
                        _, coordinates_of_coordinate = self._get_metadata_and_coordinates(
                            entry, ids, str(target), occurrence
                        )
                        shape_factors = []

                        for k, v in coordinates_of_coordinate.items():
                            if k == target:
                                continue
                            shape_factors.append(f"#{ids}/{k}")
                        # ====================================

                        # If direct coordinate of node is 1...N, replace name with '1...N'
                        # (otherwise coordinate name would be the same as target node name)
                        coordinate_name = splitted_target[-1]
                        if f"{target}" == f"{node_path}":
                            coordinate_name = "1...N"

                        try:
                            coord_data_shape = np.asarray(coord_values).shape
                        except ValueError:
                            coord_data_shape = "irregular"

                        c = {
                            "name": coordinate_name,
                            "target": f"#{ids}/{target}",
                            "unit": "",
                            "shape": coord_data_shape,
                            "downsampled_shape": coord_data_shape,
                            "ndim": 1,  # 1...N coord always have 1 dimension
                            "path": "",
                            "description": "1...N",
                            "coordinates": shape_factors,
                            "shapes_dimension": shapes_dimension,
                            "value": labels if labels else coord_values,
                        }
                        coordinates_to_be_returned.append(c)

                    else:
                        coord_path = IDSPath(coord)
                        coord_real_paths = list(coord_path.items())
                        coord_data = self._get_raw_data(ids_obj, coord_real_paths)
                        self._check_data_is_leaf_node(coord_data)

                        first_value = find_first_value_in_list(coord_data)

                        # ==================================== find and add shape factors
                        _, coordinates_of_coordinate = self._get_metadata_and_coordinates(entry, ids, coord, occurrence)
                        shape_factors = []

                        for k, v in coordinates_of_coordinate.items():
                            if str(k) == coord:
                                continue
                            shape_factors.append(f"#{ids}/{k}")
                        # ====================================

                        try:
                            coord_data_shape = np.asarray(coord_data).shape
                        except ValueError:
                            coord_data_shape = "irregular"

                        c = {
                            "name": coord.split("/")[-1],
                            "target": f"#{ids}/{target}",
                            "unit": first_value.metadata.units,
                            "shape": coord_data_shape,  # coord_data could be np.ndarray or list[np.ndarray]
                            "downsampled_shape": coord_data_shape,
                            "ndim": first_value.metadata.ndim,
                            "path": f"#{ids}/{coord}",
                            "description": first_value.metadata.documentation,
                            "coordinates": shape_factors,
                            "shapes_dimension": shapes_dimension,
                            "value": coord_data,
                        }
                        coordinates_to_be_returned.append(c)
            first_value = find_first_value_in_list(ids_data)
            data_to_be_returned = ids_data

            if first_value.metadata.ndim == 2:
                # Transform 2D arrays.
                # By default first dimension of 2D has coordinate that is second on the list
                # FE expects data's first dimension to be connected with second dimension, thus this transformation
                data_to_be_returned = transform_2D_data(data_to_be_returned)
            try:
                original_data_shape = np.asarray(data_to_be_returned).shape
            except ValueError:
                original_data_shape = "irregular"
            # Downsample only 1D data
            if first_value.metadata.ndim == 1:
                if coordinates_to_be_returned[0]["target"].split("/")[-1] == f"{node_path.split('/')[-1]}":
                    # If coordinate targets node -> downsample coordinate as well
                    try:
                        coordinates_to_be_returned[0]["value"], data_to_be_returned = downsample_data(
                            data_to_be_returned,
                            target_size=downsampled_size,
                            method=downsampling_method,
                            x=coordinates_to_be_returned[0]["value"],
                            single_x_axis=(coordinates_to_be_returned[0]["path"] == f"#{ids}/time"),
                        )
                    except BaseException as e:
                        raise InvalidParametersException(f"Downsampling failed: {e}") from None

                else:
                    try:
                        _, data_to_be_returned = downsample_data(
                            data_to_be_returned, target_size=downsampled_size, method=downsampling_method
                        )
                    except Exception as e:
                        raise InvalidParametersException(f"Downsampling failed: {e}") from None
            # serialize coordinates and update shapes (they could be changed by downsampling)
            for c in coordinates_to_be_returned:
                try:
                    c["downsampled_shape"] = np.asarray(c["value"]).shape
                except ValueError:
                    c["downsampled_shape"] = "irregular"
            try:
                downsampled_shape = np.asarray(data_to_be_returned).shape
            except ValueError:
                downsampled_shape = "irregular"
            result = {
                "data": {
                    "name": node_path.split("/")[-1],
                    "unit": first_value.metadata.units,
                    "shape": original_data_shape,
                    "downsampled_shape": downsampled_shape,
                    "ndim": first_value.metadata.ndim,
                    "path": f"#{ids}/{node_path}",
                    "description": first_value.metadata.documentation,
                    "coordinates": coordinates_to_be_returned,
                    "value": data_to_be_returned,
                }
            }

            # =================================
            # update shape factors
            for coordinate in coordinates_to_be_returned:
                new_shape_factors_list = []
                for shape_factor in coordinate["coordinates"]:
                    # search for coordinates that have <shape_factor> name in "target" key
                    coord_name = next(x["name"] for x in coordinates_to_be_returned if x["target"] == shape_factor)
                    new_shape_factors_list.append(coord_name)
                coordinate["coordinates"] = new_shape_factors_list
        return result


    def _is_empty(self, seq):
        """Checks if list is essentially empty (contains only empty lists or empty strings)"""
        if isinstance(seq, (IDSNumericArray, IDSString0D, IDSString1D, IDSComplex0D, IDSFloat0D, IDSInt0D)):
            return not seq.has_value
        if isinstance(seq, np.ndarray):
            return seq.size == 0
        if isinstance(seq, list):
            return all(map(self._is_empty, seq))
        if np.isnan(seq):
            return True
        else:
            return False

    def _replace_empty_numbers(self, arr, replace_to=np.nan):
        for i, x in enumerate(arr):
            if isinstance(x, list):
                self._replace_empty_numbers(x, replace_to)
            else:

                try:
                    if not x.has_value:
                        arr[i] = replace_to
                # exception occurs for numpy values e.g. numpy.float64
                except AttributeError:
                    if x == imas.ids_defs.EMPTY_FLOAT or x == imas.ids_defs.EMPTY_INT or x == imas.ids_defs.EMPTY_COMPLEX:
                        arr[i] = replace_to
