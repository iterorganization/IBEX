"""Endpoints returning informations about server"""

from fastapi import APIRouter  # type: ignore

from ibex.core import ibex_service
from ibex.core.utils import DownsamplingMethods
from ibex import __version__
from ibex.endpoints.schemas.info_schemas import VersionResponse, DownsamplingMethodsResponse

router = APIRouter()


@router.get(
    "/info/version",
    status_code=200,
    response_model=VersionResponse,
    responses={
        200: {"description": "IBEX version returned successfully"},
    },
    description="Returns IBEX version",
)
@ibex_service.measure_execution_time
def version() -> dict:
    """
    IBEX endpoint. Returns backend version.

    | Response JSON is constructed as follows:
    | {
    |     "version": <IBEX_version (str)>
    | }

    :rtype: dict (automatically converted to JSON by FastAPI)
    :return: JSON response

    """
    res = {"version": str(__version__)}
    return res


@router.get(
    "/info/downsampling_methods",
    status_code=200,
    response_model=DownsamplingMethodsResponse,
    responses={
        200: {"description": "Downsampling methods returned successfully"},
    },
    description="Returns list of available downsampling methods provided by the server",
)
@ibex_service.measure_execution_time
def downsampling_methods() -> dict:
    """
    IBEX endpoint. Returns list of available downsampling methods to be passed to /data/plot_data endpoint as query argument.

    | Response JSON is constructed as follows:
    | {
    |     "downsampling_methods": [
    |     {
    |       "name": <method_name>,
    |       "description": <method_description>
    |     },
    |     ...
    |     ]
    | }

    :rtype: dict (automatically converted to JSON by FastAPI)
    :return: JSON response

    """

    methods = [{"name": val.value["name"], "description": val.value["description"]} for val in DownsamplingMethods]
    res = {"downsampling_methods": methods}
    return res
