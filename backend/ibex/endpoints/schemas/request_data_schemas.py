from pydantic import BaseModel, Field
from typing import Optional, List

# ========== PLOT DATA ==========


class PlotDataRequestModel(BaseModel):
    """..."""

    uri: str = Field(description="IMAS URI")
    interpolate_over: Optional[List[str]] = Field(
        default=None, description="List of IMAS URIs to be used in data interpolation"
    )
    downsampling_method: str | None = Field(default=None, description="Downsampling method to be used")
    downsampled_size: int = Field(default=1000, description="Desired size of the data after downsampling")
    apply_smoothing: bool | None = Field(default=False, description="Whenever to apply data smoothing to response data")
    smoothing_sigma: float | None = Field(
        default=None,
        description="Parameter used in Gaussian smoothing algorithm. See https://docs.scipy.org/doc/scipy/reference/generated/scipy.ndimage.gaussian_filter.html.",
    )
