"""Endpoints extracting auxiliary info from data source"""

from typing import Optional

from fastapi import APIRouter  # type: ignore

from ibex.core import ibex_service
from ibex.endpoints.schemas.response_data_entry_schemas import (
    UriFromPathResponse,
    ExistsResponse,
    ListIdsesResponse,
    AvailableEntriesResponse,
)

router = APIRouter()


@router.get(
    "/data_entry/uri_from_path",
    status_code=200,
    response_model=UriFromPathResponse,
    responses={200: {"description": "Success"}, 465: {"description": "Cannot generate URI from path"}},
    description="Takes path from query and converts it into URI",
)
@ibex_service.measure_execution_time
def uri_from_path(path: str) -> dict:
    """
    IBEX endpoint. Returns uri based on PATH passed as parameter.

    | Response JSON is constructed as follows:
    | {
    |     "uri": <IMAS_uri>
    | }

    :param: path: path to the file
    :rtype: dict (automatically converted to JSON by FastAPI)
    :return: JSON response


    """
    return ibex_service.uri_from_path(path.strip())


@router.get(
    "/data_entry/exists",
    status_code=200,
    response_model=ExistsResponse,
    responses={
        200: {"description": "Success"},
    },
    description="Checks if given pulsefile can be opened",
)
@ibex_service.measure_execution_time
def exists(uri: str) -> dict:
    """
    IBEX endpoint. Checks if pulsefile exists and can be opened.

    | Response JSON is constructed as follows:
    | {
    |     "exists": <true_or_false>
    | }

    :param uri: IMAS URI
    :rtype: dict (automatically converted to JSON by FastAPI)
    :return: JSON response


    """
    return ibex_service.data_entry_exists(uri.strip())


@router.get(
    "/data_entry/list_idses",
    status_code=200,
    response_model=ListIdsesResponse,
    responses={
        200: {"description": "Success"},
        404: {"description": "Could not open given pulsefile"},
    },
    description="Lists all idses from given pulsefile",
)
@ibex_service.measure_execution_time
def list_idses(uri: str) -> dict:
    """
    IBEX endpoint. Returns list of available IDSes and occurrences from pulsefile.

    | Response JSON is constructed as follows:
    | {
    |   "idses": [
    |     {
    |       "name": <ids_name>,
    |       "occurrences": <list_of_filled_occurences (list(int))>
    |     },...
    |     ]
    | }

    :param uri: IMAS URI
    :rtype: dict (automatically converted to JSON by FastAPI)
    :return: JSON response

    """
    return ibex_service.list_idses(uri.strip())


@router.get(
    "/data_entry/available_entries",
    status_code=200,
    response_model=AvailableEntriesResponse,
    responses={
        200: {"description": "Success"},
        466: {"description": "Invalid parameters passed in query (e.g. non existing user)"},
    },
    description="Lists known data entries found on server machine",
)
@ibex_service.measure_execution_time
def available_entries(
    user: str = "public",
    backend: Optional[str] = "",
    database: Optional[str] = None,
    version: str = "3",
) -> dict:
    """
    IBEX endpoint. Returns list of available pulsefiles from current filesystem

    | Response JSON is constructed as follows:
    | {
    |   "entries": [
    |     <uri_1 (str),
    |     <uri_2 (str),
    |     ...,
    |     <uri_N (str),
    |     ]
    | }

    :param user: username - used to filter entries
    :param backend: backend - used to filter entries
    :param database: database - used to filter entries
    :param version: version - used to filter entries
    :rtype: dict (automatically converted to JSON by FastAPI)
    :return: JSON response

    """
    if not backend:
        backends = None
    else:
        backends = backend.split(" ")

    return ibex_service.list_db_entries(user, backends, database, int(version))
