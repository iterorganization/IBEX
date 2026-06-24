from typing import Optional
from enum import Enum
from pydantic import BaseModel


class InterpolationMethod(str, Enum):
    EXACT_VALUE = "exact_value"
    LINEAR = "linear"
    NEAREST = "nearest"


class SmoothingMethod(str, Enum):
    GAUSSIAN_FILTER = "gaussian_filter"
    SAVITZKY_GOLAY_FILTER = "savitzky-golay_filter"


class AdditionalParameter(BaseModel):
    """
    Parameters for specific data manipulation methods. E.g. sigma -> for Gaussian smoothing
    """

    name: str
    human_readable_name: str
    description: str
    possible_values: Optional[list[str]] = None


class PossibleValue(BaseModel):
    """
    Possible value for data manipulation method parameter. E.g. Gaussian smoothing
    """

    value: str
    description: str
    additional_parameters: Optional[list[AdditionalParameter]] = None


class DataManipulationParameter(BaseModel):
    """
    E.g. interpolate_over, type of filtering, binary operation
    """

    human_readable_name: str
    name: str
    description: str
    possible_values: Optional[list[PossibleValue]] = None


class DataManipulationOperation(BaseModel):
    """
    Type of data manipulation method. E.g. data-smoothing, data-interpolation, binary-operation
    """

    name: str
    description: str
    method_parameters: list[DataManipulationParameter]


class DataManipulationMethodsResponse(BaseModel):
    data_manipulation_methods: list[DataManipulationOperation]


available_methods = DataManipulationMethodsResponse(data_manipulation_methods=[])

# ====================== DATA INTERPOLATION ======================

data_interpolation_description = DataManipulationOperation(
    name="Data interpolation",
    description="Operation performed in order to represent dataset over different set of coordinates",
    method_parameters=[],
)

# ====================== DATA INTERPOLATION PARAMETERS ======================

data_interpolation_interpolate_over_parameter = DataManipulationParameter(
    human_readable_name="Interpolate over",
    name="interpolate_over",
    description="List of URIs to gather coordinates from, for interpolation",
)

data_interpolation_method_parameter = DataManipulationParameter(
    human_readable_name="Interpolation method",
    name="interpolation_method",
    description="List of URIs to gather coordinates from, for interpolation",
    possible_values=[
        PossibleValue(
            value=InterpolationMethod.EXACT_VALUE,
            description="values are present only on data points where they were originally. Rest of the data grid is filled with NaNs",
        ),
        PossibleValue(
            value=InterpolationMethod.LINEAR,
            description="see scipy.interpolate.RegularGridInterpolator documentation",
        ),
        PossibleValue(
            value=InterpolationMethod.NEAREST,
            description="see scipy.interpolate.RegularGridInterpolator documentation",
        ),
    ],
)

data_interpolation_description.method_parameters.append(data_interpolation_interpolate_over_parameter)
data_interpolation_description.method_parameters.append(data_interpolation_method_parameter)
available_methods.data_manipulation_methods.append(data_interpolation_description)

# ====================== DATA SMOOTHING ======================

data_smoothing_description = DataManipulationOperation(
    name="Data smoothing/denoising",
    description="Operation performed in order to eliminate noise from data",
    method_parameters=[],
)

# ====================== DATA SMOOTHING PARAMETERS ======================

data_smoothing_method_parameter = DataManipulationParameter(
    human_readable_name="Smoothing method",
    name="smoothing_method",
    description="Method to be used in data smoothing process",
    possible_values=[
        PossibleValue(
            value=SmoothingMethod.GAUSSIAN_FILTER,
            description="see scipy.ndimage.gaussian_filter documentation",
            additional_parameters=[
                AdditionalParameter(
                    name="gaussian_smoothing_sigma",
                    human_readable_name="Sigma",
                    description="Standard deviation for Gaussian kernel.",
                )
            ],
        ),
        PossibleValue(
            value=SmoothingMethod.SAVITZKY_GOLAY_FILTER,
            description="see scipy.signal.savgol_filter documentation",
            additional_parameters=[
                AdditionalParameter(
                    name="savgol_smoothing_window_length",
                    human_readable_name="Window length",
                    description="The length of the filter window (i.e., the number of coefficients). If mode is `interp`, window_length must be less than or equal to the size of x.",
                ),
                AdditionalParameter(
                    name="savgol_smoothing_polyorder",
                    human_readable_name="Polyorder",
                    description="The order of the polynomial used to fit the samples. polyorder must be less than window_length.",
                ),
                AdditionalParameter(
                    name="savgol_smoothing_deriv",
                    human_readable_name="Deriv",
                    description="The order of the derivative to compute. This must be a nonnegative integer. The default is 0, which means to filter the data without differentiating.",
                ),
                AdditionalParameter(
                    name="savgol_smoothing_delta",
                    human_readable_name="Window delta",
                    description="The spacing of the samples to which the filter will be applied. This is only used if deriv > 0. Default is 1.0.",
                ),
                AdditionalParameter(
                    name="savgol_smoothing_mode",
                    human_readable_name="Mode",
                    description="This determines the type of extension to use for the padded signal to which the filter is applied.",
                    possible_values=["mirror", "constant", "nearest", "wrap", "interp"],
                ),
                AdditionalParameter(
                    name="savgol_smoothing_cval",
                    human_readable_name="C-Val",
                    description="Value to fill past the edges of the input if mode is `constant`. Default is 0.0.",
                ),
            ],
        ),
    ],
)

data_smoothing_description.method_parameters.append(data_smoothing_method_parameter)
available_methods.data_manipulation_methods.append(data_smoothing_description)
