"""Endpoints extracting data from data source"""

import orjson
from typing import List, Any

from fastapi import APIRouter, Query  # type: ignore
from fastapi.responses import ORJSONResponse  # type: ignore

from ibex.core import ibex_service
from ibex.endpoints.schemas.data_schemas import FieldValueResponse, PlotDataResponse

router = APIRouter()


class CustomORJSONResponse(ORJSONResponse):
    """
    Custom ORJSON serializer. Uses serializer from data_source to transform arbitrary types (e.g. IDSNumericArray) to ones supported by ORJSON serializer (e.g. np.array).
    """

    def render(self, content) -> bytes:
        return orjson.dumps(
            content, default=ibex_service.data_source.data_serializer_custom, option=orjson.OPT_SERIALIZE_NUMPY
        )


@router.get(
    "/data/field_value",
    status_code=200,
    response_model=FieldValueResponse,
    response_class=CustomORJSONResponse,
    responses={
        200: {"description": "Field value returned successfully"},
        404: {"description": "Data node not found"},
        461: {"description": "Given path does not point to leaf node"},
        464: {"description": "Given data node is empty"},
    },
    description="Returns single (or tensorized) data node value",
)
@ibex_service.measure_execution_time
def field_value(
    uri: str,
    downsampling_method: str | None = Query(None),
    downsampled_size: int = 1000,
    range: List[int] = Query(None),
) -> Any:
    """
    IBEX endpoint. Returns value extracted from pulsefile's leaf node.

    | Response JSON is constructed as follows:
    | {
    |     "value": <extracted_value(s)>
    | }

    :param uri: IMAS URI with the path to leaf node
    :param downsampling_method: one of the downsampling metods returend by :func:`~ibex.endpoints.info.downsampling_methods` endpoint, or None
    :param downsampled_size: target size of downsampled data
    :rtype: dict (automatically converted to JSON by FastAPI)
    :return: JSON response

    """
    return CustomORJSONResponse(ibex_service.get_data(uri.strip(), downsampling_method, downsampled_size, range))


@router.get(
    "/data/plot_data",
    status_code=200,
    response_model=PlotDataResponse,
    response_class=CustomORJSONResponse,
    responses={
        200: {"description": "Plot data returned successfully"},
        404: {"description": "Data node not found"},
        464: {"description": "Given data node is empty"},
    },
    description="Returns single (or tensorized) data node value with detailed parameters used to plot the data",
)
@ibex_service.measure_execution_time
def plot_data(uri: str, downsampling_method: str | None = Query(None), downsampled_size: int = 1000) -> Any:
    """
    IBEX endpoint. Prepares and returns full information about data node and it's coordinates.

    | Response JSON is constructed as follows:
    | {
    |   "data": {
    |     "name": <node_name (str)>,
    |     "unit": <data_unit (str)>,
    |     "shape": <original_data_shape (list(int))>,
    |     "downsampled_shape": <data_shape list(int)>,
    |     "ndim": <number_of_data_dimensions (int)>,
    |     "path": <path_to_selected_node (str)>,
    |     "description": <node_description (str)>,
    |     "coordinates": [
    |       {
    |         "name": <node_name (str)>,
    |         "target": <path_to_origin_node_of_coordinate (str)>,
    |         "unit": <data_unit (str)>,
    |         "shape": <original_data_shape list(int)>,
    |         "downsampled_shape": <data_shape list(int)>,
    |         "ndim": <number_of_data_dimensions (int)>,
    |         "path": <path_to_coordonate (str)>,
    |         "description": <coordinate_description (str)>,
    |         "coordinates": <names_of_coordinates_of_this_coordinate (list(str))>,
    |         "shapes_dimension": <if_coordinate_has_influence_on_data_shape (bool)>,
    |         "value": <value(s)_of_coordinate>
    |       },
    |     {<another_coordinate},
    |     ...],
    |     "value": <value(s)_of_selected_data_node>
    |   }
    | }

    :param uri: IMAS URI with the path to leaf node
    :param downsampling_method: one of the downsampling metods returend by :func:`~ibex.endpoints.info.downsampling_methods` endpoint, or None
    :param downsampled_size: target size of downsampled data
    :rtype: dict (automatically converted to JSON by FastAPI)
    :return: JSON response
    """
    return CustomORJSONResponse(ibex_service.get_plot_data(uri.strip(), downsampling_method, downsampled_size))
