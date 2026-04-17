from pydantic import BaseModel, Field


# ========== VERSION ==========
class VersionResponse(BaseModel):
    """Response for /info/version endpoint"""

    version: str = Field(description="IBEX version", examples=["0.0.1", "1.0.2"])


# ========== DOWNSAMPLING METHODS ==========
class DownsamplingMethodModel(BaseModel):
    """Intermediate model for /info/downsampling_methods endpoint"""

    name: str = Field(description="Method name", examples=["STEP", "STEP_AVERAGE"])
    description: str = Field(description="Method description", examples=["Simple step algorithm"])


class DownsamplingMethodsResponse(BaseModel):
    """Response for /info/downsampling_methods endpoint"""

    downsampling_methods: list[DownsamplingMethodModel] = Field(description="Available downsampling methods")
