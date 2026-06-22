from pydantic import BaseModel, Field
from typing import Any

# ========== FIELD VALUE ==========


class FieldValueResponse(BaseModel):
    """Response for /data/field_value endpoint"""

    value: Any = Field(description="Extracted value", examples=[[1, 2, 3], "test_string", 10])


# ========== PLOT DATA ==========


class PlotDataCoordinateModel(BaseModel):
    """Intermediate model for /data/plot_data endpoint"""

    name: str = Field(description="Node name", examples=["dim1"])
    target: str = Field(
        description="Which node coordinate is it", examples=["#equilibrium/time_slice[0]/profiles_2d[0]/psi"]
    )
    unit: str = Field(description="Data units", examples=[""])
    shape: list[int] | str = Field(description="Shape of the data", examples=[[129]])
    downsampled_shape: list[int] | str = Field(description="Shape of the data after downsampling", examples=[[129]])
    ndim: int = Field(description="Number of data dimensions stored in node", examples=[1])
    path: str = Field(description="Path to the node", examples=["#equilibrium/time_slice[0]/profiles_2d[0]/grid/dim1"])
    description: str = Field(description="Description of the node", examples=["First dimension values"])
    coordinates: list[str] = Field(
        description="List of coordinate coordinates names", examples=[["profiles_2d", "time"]]
    )
    value: Any = Field(description="Coordinate value", examples=[[1, 2, 3], "test_string", 10])


class PlotDataModel(BaseModel):
    """Intermediate model for /data/plot_data endpoint"""

    name: str = Field(description="Node name", examples=["psi"])
    unit: str = Field(description="Data units", examples=["Wb"])
    shape: list[int] | str = Field(description="Shape of the data", examples=[[129, 65]])
    downsampled_shape: list[int] | str = Field(description="Shape of the data after downsampling", examples=[[129, 65]])
    ndim: int = Field(description="Number of data dimensions stored in node", examples=[2])
    path: str = Field(description="Path to the node", examples=["#equilibrium/time_slice[0]/profiles_2d[0]/psi"])
    description: str = Field(
        description="Description of the node",
        examples=["Values of the poloidal flux at the grid in the poloidal plane"],
    )
    coordinates: list[PlotDataCoordinateModel] = Field(description="List of node's coordinates")
    value: Any = Field(description="Extracted value", examples=[[1, 2, 3], "test_string", 10])


class PlotDataResponse(BaseModel):
    """Response for /data/plot_data endpoint"""

    data: PlotDataModel = Field(description="Plot data")
