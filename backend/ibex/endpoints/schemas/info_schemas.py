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


# ========== DATA MANIPULATION METHODS ==========


class DataManipulationMethodParameterPossibleValuesModel(BaseModel):
    """Intermediate model for /info/data_manipulation_methods endpoint"""

    value: str = Field(description="Possible value of parameter", examples=["linear", "nearest"])
    description: str = Field(
        description="Value description",
        examples=[
            "New point value will be interpolated using linear algorithm",
            "New point value will be interpolated using nearest value",
        ],
    )


class DataManipulationMethodParametersModel(BaseModel):
    """Intermediate model for /info/data_manipulation_methods endpoint"""

    human_readable_name: str = Field(
        description="Human readable name of the parameter to be displayed in FE", examples=["Sigma", "Deviation level"]
    )
    name: str = Field(description="URL parameter name", examples=["sigma", "deviation_level"])
    description: str = Field(description="Parameter description", examples=["Standard deviation for Gaussian kernel."])
    possible_values: list[DataManipulationMethodParameterPossibleValuesModel] | None = Field(
        default=None, description="Possible values for manipulation parameter"
    )


class DataManipulationMethodModel(BaseModel):
    """Intermediate model for /info/data_manipulation_methods endpoint"""

    name: str = Field(description="Method name", examples=["interpolation", "smoothing"])
    description: str = Field(description="Method description", examples=["Gaussian smoothing"])
    method_parameters: list[DataManipulationMethodParametersModel] = Field(
        description="Parameters used in data manipulation method"
    )


class DataManipulationMethodsResponse(BaseModel):
    """Response for /info/data_manipulation_methods endpoint"""

    data_manipulation_methods: list[DataManipulationMethodModel] = Field(
        description="Available data manipulation methods"
    )
