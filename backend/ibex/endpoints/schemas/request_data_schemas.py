from pydantic import BaseModel, Field, model_validator
from typing import Optional, List
from ibex.core.data_manipulation_methods import available_methods, SmoothingMethod
from enum import Enum


def _get_parameter_possible_values(parameter_name: str) -> list[str]:
    """
    Helper function. Return allowed values declared for a top-level data manipulation parameter.
    """
    for method in available_methods.data_manipulation_methods:
        for method_parameter in method.method_parameters:
            if method_parameter.name == parameter_name:
                return [possible_value.value for possible_value in (method_parameter.possible_values or [])]
    return []


def _get_connected_parameter_possible_values(parameter_name: str) -> list[str]:
    """
    Helper function. Returns allowed values for a connected parameter referenced by name.
    :param parameter_name:
    :return:
    """
    for method in available_methods.data_manipulation_methods:
        for method_parameter in method.method_parameters:
            if not method_parameter.possible_values:
                continue

            for possible_value in method_parameter.possible_values:
                if not possible_value.additional_parameters:
                    continue

                for connected_parameter in possible_value.additional_parameters:
                    if connected_parameter.name == parameter_name:
                        return connected_parameter.possible_values or []

    raise ValueError(f"Possible values for '{parameter_name}' not found")


# Create ENUM from savgol smoothing mode (for validation)
SavgolSmoothingMode = Enum(
    "SavgolSmoothingMode",
    {value.upper(): value for value in _get_connected_parameter_possible_values("savgol_smoothing_mode")},
    type=str,
)

# ========== PLOT DATA ==========


class SavgolSmoothingParameters(BaseModel):
    savgol_smoothing_window_length: int | None = Field(
        default=None,
        description="The length of the filter window (i.e., the number of coefficients). If mode is 'interp', window_length must be less than or equal to the size of x.",
    )
    savgol_smoothing_polyorder: int | None = Field(
        default=None,
        description="The order of the polynomial used to fit the samples. polyorder must be less than window_length.",
    )
    savgol_smoothing_deriv: int | None = Field(
        default=None,
        description="The order of the derivative to compute. This must be a nonnegative integer. The default is 0, which means to filter the data without differentiating.",
    )
    savgol_smoothing_delta: float | None = Field(
        default=None,
        description="The spacing of the samples to which the filter will be applied. This is only used if deriv > 0. Default is 1.0.",
    )
    savgol_smoothing_mode: SavgolSmoothingMode = Field(
        default=SavgolSmoothingMode.INTERP,
        description="Must be 'mirror', 'constant', 'nearest', 'wrap' or 'interp' (default).",
    )
    savgol_smoothing_cval: float | None = Field(
        default=None,
        description="Value to fill past the edges of the input if mode is 'constant'. Default is 0.0.",
    )


class GaussianSmoothingParameters(BaseModel):
    gaussian_smoothing_sigma: float | None = Field(
        default=None,
        description="Standard deviation for Gaussian kernel.",
    )


class PlotDataBasicParameters(BaseModel):
    """..."""

    uri: str = Field(description="IMAS URI")
    interpolate_over: Optional[List[str]] = Field(
        default=None, description="List of IMAS URIs to be used in data interpolation"
    )
    interpolation_method: str | None = Field(default=None, description="Interpolation method to be used")
    downsampling_method: str | None = Field(default=None, description="Downsampling method to be used")
    downsampled_size: int = Field(default=1000, description="Desired size of the data after downsampling")
    smoothing_method: SmoothingMethod | None = Field(default=None, description="Smoothing method to be used")
    operations: Optional[List[str]] = Field(
        default=None,
        description="Ordered list of scalar operations in format 'type:value' e.g. 'add:10'",
    )


class PlotDataRequestModel(
    PlotDataBasicParameters,
    SavgolSmoothingParameters,
    GaussianSmoothingParameters,
):
    @model_validator(mode="after")
    def validate_gaussian_smoothing_parameters(self) -> "PlotDataRequestModel":
        if self.smoothing_method == SmoothingMethod.GAUSSIAN_FILTER and self.gaussian_smoothing_sigma is None:
            raise ValueError("gaussian_smoothing_sigma is required when smoothing_method is 'gaussian_filter'")

        if self.smoothing_method == SmoothingMethod.SAVITZKY_GOLAY_FILTER:
            if self.savgol_smoothing_window_length is None:
                raise ValueError(
                    "savgol_smoothing_window_length is required when smoothing_method is 'savitzky_golay_filter'"
                )

            if self.savgol_smoothing_polyorder is None:
                raise ValueError(
                    "savgol_smoothing_polyorder is required when smoothing_method is 'savitzky_golay_filter'"
                )

        return self

    @model_validator(mode="after")
    def validate_arithmetic_parameters(self) -> "PlotDataRequestModel":
        if self.division_divisor == 0:
            raise ValueError("division_divisor cannot be 0")

        signal_uri_lists = [
            self.signal_addition_addend_uri,
            self.signal_subtraction_subtrahend_uri,
            self.signal_multiplication_factor_uri,
            self.signal_division_divisor_uri,
        ]
        for uri_list in signal_uri_lists:
            if uri_list:
                for signal_uri in uri_list:
                    if not self.interpolate_over or signal_uri not in self.interpolate_over:
                        raise ValueError(f"Signal URI '{signal_uri}' must be listed in interpolate_over")

        signal_priorities = [
            self.signal_addition_priority,
            self.signal_subtraction_priority,
            self.signal_multiplication_priority,
            self.signal_division_priority,
        ]
        defined_signal_priorities = [p for p in signal_priorities if p is not None]
        if len(defined_signal_priorities) != len(set(defined_signal_priorities)):
            raise ValueError("signal operation priorities must be unique")

        priorities = [
            self.addition_priority,
            self.subtraction_priority,
            self.multiplication_priority,
            self.division_priority,
            self.exponentiation_priority,
            self.root_priority,
        ]
        defined_priorities = [p for p in priorities if p is not None]
        if len(defined_priorities) != len(set(defined_priorities)):
            raise ValueError("operation priorities must be unique")

        return self
