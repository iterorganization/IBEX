from pydantic import BaseModel, Field
from typing import Optional

# ========== NODE INFO ==========


class NodeInfoChildModel(BaseModel):
    """Intermediate model for /ids_info/node_info endpoint"""

    name: str = Field(description="Node name", examples=["t_i_average", "psi"])
    type: str = Field(description="Node type", examples=["FLT", "STR"])
    ndim: int = Field(description="Number of data dimensions stored in node", examples=[1, 5, 7])
    is_geometry_node: bool = Field(description="True if node is inside geometry structure", examples=[True, False])
    has_data: Optional[bool] = Field(default=None, description="True if node contains data", examples=[True, False])


class NodeInfoResponse(BaseModel):
    """Response for /ids_info/node_info endpoint"""

    name: str = Field(description="Node name", examples=["profiles_1d", "t_i_average", "psi"])
    type: str = Field(description="Node type", examples=["struct_array", "FLT", "STR"])
    ndim: int = Field(description="Number of data dimensions stored in node", examples=[1, 5, 7])
    shape: list[int] = Field(description="Shape of the data", examples=[[3], [5], [2, 5, 10]])
    is_geometry_node: bool = Field(description="True if node is inside geometry structure", examples=[True, False])
    has_data: Optional[bool] = Field(default=None, description="True if node contains data", examples=[True, False])
    children: list[NodeInfoChildModel] = Field(description="Node info about node's children")
    coordinates: list[str] = Field(
        description="Node coordinate paths", examples=[["time"], ["rho_tor_norm"], ["dim1", "dim2"]]
    )


# ========== FIND PATHS ==========


class FoundPathModel(BaseModel):
    """Inner model for FindPathsResponse"""

    path: str = Field(description="", examples=["t_i_average", "path"])
    has_data: Optional[bool] = Field(default=None, description="True if node contains data", examples=[True, False])
    is_geometry_node: bool = Field(description="True if node contains geometry data", examples=[True, False])


class FindPathsResponse(BaseModel):
    """Response for /ids_info/find_paths endpoint"""

    paths: list[FoundPathModel] = Field(
        description="List of dicts with path name and information if path contains data"
    )


# ========== ARRAY SUMMARY ==========


class ArraySummaryResponse(BaseModel):
    """Response for /ids_info/array_summary endpoint"""

    shape: list[int] = Field(description="Shape of the data", examples=[[3], [5], [2, 5, 10]])
    min: float = Field(description="Minimum value from the array", examples=[1.2, 3.4])
    max: float = Field(description="Maximum value from the array", examples=[1.2, 3.4])
    mean: float = Field(description="Mean value from the array", examples=[1.2, 3.4])
    standard_deviation: float = Field(description="Standard deviation value of the array", examples=[1.2, 3.4])


# ========== GEOMETRY OVERLAY NODES ==========


class GeometryOverlayNodesSingleEntry(BaseModel):
    """Response for /ids_info/geometry_overlay_nodes endpoint"""

    geometry_node: str = Field(
        description="Full uri pointing to a specific geometry node structure",
        examples=["imas:hdf5?path=<entry_path>#equilibrium/time_slic[:]/profiles_2d[:]/psi"],
    )
    parameters: list[str] = Field(description="Name of child node of geometry_node", examples=["r", "z", "width"])


class GeometryOverlayNodesResponse(BaseModel):
    """Response for /ids_info/geometry_overlay_nodes endpoint"""

    outline_nodes: list[GeometryOverlayNodesSingleEntry] = Field(
        description="List of dicts describing geometry overlay node paths",
    )
