from pydantic import BaseModel, Field

# ========== NODE INFO ==========


class NodeInfoChildModel(BaseModel):
    """Intermediate model for /ids_info/node_info endpoint"""

    name: str = Field(description="Node name", examples=["t_i_average", "psi"])
    type: str = Field(description="Node type", examples=["FLT", "STR"])
    ndim: int = Field(description="Number of data dimensions stored in node", examples=[1, 5, 7])


class NodeInfoResponse(BaseModel):
    """Response for /ids_info/node_info endpoint"""

    name: str = Field(description="Node name", examples=["profiles_1d", "t_i_average", "psi"])
    type: str = Field(description="Node type", examples=["struct_array", "FLT", "STR"])
    ndim: int = Field(description="Number of data dimensions stored in node", examples=[1, 5, 7])
    shape: list[int] = Field(description="Shape of the data", examples=[[3], [5], [2, 5, 10]])
    children: list[NodeInfoChildModel] = Field(description="Node info about node's children")
    coordinates: list[str] = Field(
        description="Node coordinate paths", examples=[["time"], ["rho_tor_norm"], ["dim1", "dim2"]]
    )


# ========== FIND PATHS ==========


class FindPathsResponse(BaseModel):
    """Response for /ids_info/find_paths endpoint"""

    paths: list[str] = Field(description="List of found paths", examples=[["t_i_average", "temperature_average"]])


# ========== ARRAY SUMMARY ==========


class ArraySummaryResponse(BaseModel):
    """Response for /ids_info/array_summary endpoint"""

    shape: list[int] = Field(description="Shape of the data", examples=[[3], [5], [2, 5, 10]])
    min: float = Field(description="Minimum value from the array", examples=[1.2, 3.4])
    max: float = Field(description="Maximum value from the array", examples=[1.2, 3.4])
    mean: float = Field(description="Mean value from the array", examples=[1.2, 3.4])
    standard_deviation: float = Field(description="Standard deviation value of the array", examples=[1.2, 3.4])
