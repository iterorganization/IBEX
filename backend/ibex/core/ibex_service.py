"""Logic between endpoint and data sources"""

import time
from pathlib import Path
from functools import wraps  # for measure_execution_time()
from typing import Any, Callable, Optional, Sequence, List

from ibex.data_source.imas_python_source import IMASPythonSource
from ibex.data_source.exception import CannotGenerateUriException
from ibex.core.utils import IMAS_URI


# helper decorator used during development
# TODO to be deleted before release
def measure_execution_time(func: Callable[..., Any]) -> Callable[..., Any]:
    @wraps(func)
    async def wrapper(*args: Any, **kwargs: Any) -> Any:
        start_time = time.perf_counter()
        response = func(*args, **kwargs)
        end_time = time.perf_counter()
        execution_time = end_time - start_time
        print(f"==========> Endpoint '{func.__name__}' executed in {execution_time:.4f} seconds")
        return response

    return wrapper


def uri_from_path(path: str) -> dict:
    """
    Converts path string to uri
    """
    uri = None
    path = Path(path)
    if path.suffix == ".h5":
        uri = f"imas:hdf5?path={path.parent}"
    elif path.suffix in [".characteristics", ".datafile", ".tree"]:
        uri = f"imas:mdsplus?path={path.parent}"
    elif path.suffix == ".ids":
        uri = f"imas:ascii?path={path.parent}"
    elif path.suffix == ".nc":
        uri = path

    if not uri:
        raise CannotGenerateUriException("Cannot convert path to URI. Make sure path points to imas data file.")
    return {"uri": uri}


# =============== IBEX CORE ===============
# this is just a layer between endpoints and IBEX data source

# data_source can be replaced
data_source = IMASPythonSource()


def data_entry_exists(uri: str) -> dict:
    uri_obj = IMAS_URI(uri)
    return {"exists": data_source.data_entry_exists(uri_obj.uri_entry_identifiers)}


def get_node_info(uri: str, recursive: bool = False, show_error_bars: bool = False) -> dict:
    uri_obj = IMAS_URI(uri)
    return data_source.get_node_info(
        uri=uri_obj.uri_entry_identifiers,
        ids=uri_obj.ids_name,
        node_path=uri_obj.node_path,
        occurrence=uri_obj.occurrence,
        recursive=recursive,
        show_error_bars=show_error_bars,
    )


def get_data(uri: str, downsampling_method: str | None, downsampled_size: int) -> dict:
    uri_obj = IMAS_URI(uri)
    return data_source.get_data(
        uri=uri_obj.uri_entry_identifiers,
        ids=uri_obj.ids_name,
        node_path=uri_obj.node_path,
        occurrence=uri_obj.occurrence,
        downsampling_method=downsampling_method,
        downsampled_size=downsampled_size,
    )


def list_idses(uri: str) -> dict:
    uri_obj = IMAS_URI(uri)
    return data_source.list_idses(uri_obj.uri_entry_identifiers)


def find_paths(uri: str, searched_node: str, show_error_bars: bool = False) -> dict:
    uri_obj = IMAS_URI(uri)
    return data_source.find_paths(
        uri=uri_obj.uri_entry_identifiers, searched_node=searched_node, show_error_bars=show_error_bars
    )


def array_summary(uri: str) -> dict:
    uri_obj = IMAS_URI(uri)
    return data_source.array_summary(
        uri_obj.uri_entry_identifiers, uri_obj.ids_name, uri_obj.node_path, uri_obj.occurrence
    )


def list_db_entries(
    user: str,
    backends: Optional[Sequence[str]] = None,
    database: Optional[str] = None,
    version: Optional[int] = None,
) -> dict:
    return data_source.list_db_entries(user, backends, database, version)


def get_multiple_node_data(uri: str) -> dict:
    uri_obj = IMAS_URI(uri)
    return data_source.get_multiple_node_data(
        uri_obj.uri_entry_identifiers, uri_obj.ids_name, uri_obj.node_path, uri_obj.occurrence
    )


def get_plot_data(
    uri: str,
    interpolate_over: List[str] | None,
    interpolation_method: str | None,
    downsampling_method: str | None,
    downsampled_size: int,
) -> dict:
    uri_obj = IMAS_URI(uri)
    return data_source.get_plot_data(
        uri=uri_obj.uri_entry_identifiers,
        ids=uri_obj.ids_name,
        node_path=uri_obj.node_path,
        occurrence=uri_obj.occurrence,
        interpolate_over=interpolate_over,
        interpolation_method=interpolation_method,
        downsampling_method=downsampling_method,
        downsampled_size=downsampled_size,
    )
