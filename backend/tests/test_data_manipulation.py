import numpy as np
import pytest
from ibex.data_source.imas_python_source_utils import (
    apply_gaussian_filter,
    apply_savgol_filter,
    apply_signal_operations,
    apply_simple_operations,
)
from ibex.endpoints.schemas.request_data_schemas import PlotDataRequestModel
from pydantic_core._pydantic_core import ValidationError


def test_apply_signal_operations_addition():
    addend_uri = "imas:hdf5?path=/dummy/interpolation_db_1#equilibrium/time_slice[:]/profiles_2d[:]/psi"
    data = np.array([1.0, 2.0, 3.0])
    request = PlotDataRequestModel(
        uri="imas:hdf5?path=/dummy#dummy",
        interpolate_over=[addend_uri],
        signal_addition_addend_uri=[addend_uri],
    )
    signal_data_by_uri = {addend_uri: np.array([10.0, 20.0, 30.0])}
    result = apply_signal_operations(data, request, signal_data_by_uri)
    assert np.allclose(result, [11.0, 22.0, 33.0])


def test_apply_signal_operations_subtraction():
    subtrahend_uri = "imas:hdf5?path=/dummy/interpolation_db_2#equilibrium/time_slice[:]/profiles_2d[:]/psi"
    data = np.array([10.0, 20.0, 30.0])
    request = PlotDataRequestModel(
        uri="imas:hdf5?path=/dummy#dummy",
        interpolate_over=[subtrahend_uri],
        signal_subtraction_subtrahend_uri=[subtrahend_uri],
    )
    signal_data_by_uri = {subtrahend_uri: np.array([1.0, 2.0, 3.0])}
    result = apply_signal_operations(data, request, signal_data_by_uri)
    assert np.allclose(result, [9.0, 18.0, 27.0])


def test_apply_signal_operations_multiplication():
    factor_uri = "imas:hdf5?path=/dummy/interpolation_db_1#equilibrium/time_slice[:]/profiles_2d[:]/psi"
    data = np.array([1.0, 2.0, 3.0])
    request = PlotDataRequestModel(
        uri="imas:hdf5?path=/dummy#dummy",
        interpolate_over=[factor_uri],
        signal_multiplication_factor_uri=[factor_uri],
    )
    signal_data_by_uri = {factor_uri: np.array([2.0, 3.0, 4.0])}
    result = apply_signal_operations(data, request, signal_data_by_uri)
    assert np.allclose(result, [2.0, 6.0, 12.0])


def test_apply_signal_operations_division():
    divisor_uri = "imas:hdf5?path=/dummy/interpolation_db_2#equilibrium/time_slice[:]/profiles_2d[:]/psi"
    data = np.array([10.0, 20.0, 30.0])
    request = PlotDataRequestModel(
        uri="imas:hdf5?path=/dummy#dummy",
        interpolate_over=[divisor_uri],
        signal_division_divisor_uri=[divisor_uri],
    )
    signal_data_by_uri = {divisor_uri: np.array([2.0, 5.0, 6.0])}
    result = apply_signal_operations(data, request, signal_data_by_uri)
    assert np.allclose(result, [5.0, 4.0, 5.0])


def test_apply_gaussian_smoothing():
    data = np.array([10.25, 12.8, 15.4, 18.15, 21.0, 24.35, 27.6, 30.2, 33.75, 36.1])

    expected_sigma_1 = [11.343, 13.002, 15.479, 18.228, 21.18, 24.309, 27.414, 30.417, 33.211, 35.019]
    expected_sigma_2 = [13.286, 14.311, 16.176, 18.615, 21.385, 24.291, 27.152, 29.743, 31.761, 32.881]

    assert expected_sigma_1 == pytest.approx(apply_gaussian_filter(data, sigma=1), 0.1)
    assert expected_sigma_2 == pytest.approx(apply_gaussian_filter(data, sigma=2), 0.1)


def test_apply_savitzky_golay_smoothing():
    data = np.array([10.25, 12.8, 15.4, 18.15, 21.0, 24.35, 27.6, 30.2, 33.75, 36.1])

    expected_window_5_poly_2 = [10.257, 12.781, 15.413, 18.111, 21.086, 24.346, 27.416, 30.521, 33.426, 36.209]
    expected_window_7_poly_3_deriv_1 = [2.533, 4.694, 5.717, 5.69, 6.303, 6.242, 6.338, 6.442, 5.184, 2.735]

    assert expected_window_5_poly_2 == pytest.approx(
        apply_savgol_filter(
            data,
            window_length=5,
            polyorder=2,
            deriv=0,
            delta=1.0,
            mode="interp",
            cval=0.0,
        ),
        0.1,
    )

    assert expected_window_7_poly_3_deriv_1 == pytest.approx(
        apply_savgol_filter(
            data,
            window_length=7,
            polyorder=3,
            deriv=1,
            delta=0.5,
            mode="nearest",
            cval=0.0,
        ),
        0.1,
    )


@pytest.mark.parametrize(
    ("request_kwargs", "data", "expected"),
    [
        ({"addition_addend": 2}, np.array([1.0, 2.0, 3.0]), np.array([3.0, 4.0, 5.0])),
        ({"subtraction_subtrahend": 1}, np.array([3.0, 4.0, 5.0]), np.array([2.0, 3.0, 4.0])),
        ({"multiplication_factor": 3}, np.array([1.0, 2.0, 3.0]), np.array([3.0, 6.0, 9.0])),
        ({"division_divisor": 2}, np.array([2.0, 4.0, 6.0]), np.array([1.0, 2.0, 3.0])),
        ({"exponentiation_exponent": 2}, np.array([2.0, 3.0, 4.0]), np.array([4.0, 9.0, 16.0])),
        ({"root_degree": 2}, np.array([1.0, 4.0, 9.0]), np.array([1.0, 2.0, 3.0])),
    ],
)
def test_apply_simple_operations(request_kwargs, data, expected):
    request = PlotDataRequestModel(uri="imas:hdf5?path=/dummy#dummy", **request_kwargs)

    assert np.asarray(expected) == pytest.approx(apply_simple_operations(data, request))


def test_apply_simple_operations_recurses_over_lists():
    request = PlotDataRequestModel(uri="imas:hdf5?path=/dummy#dummy", addition_addend=1)
    data = [np.array([1.0, 2.0]), np.array([3.0, 4.0])]

    result = apply_simple_operations(data, request)

    assert np.asarray(result[0]) == pytest.approx([2.0, 3.0])
    assert np.asarray(result[1]) == pytest.approx([4.0, 5.0])


def test_apply_simple_operations_rejects_division_by_zero():
    with pytest.raises(ValidationError, match="division_divisor cannot be 0"):
        PlotDataRequestModel(uri="imas:hdf5?path=/dummy#dummy", division_divisor=0)


def test_apply_simple_operations_uses_priority_order():
    request = PlotDataRequestModel(
        uri="imas:hdf5?path=/dummy#dummy",
        addition_addend=1,
        multiplication_factor=2,
        addition_priority=2,
        multiplication_priority=1,
    )
    data = np.array([5.0])
    # default order: add then multiply -> (5+1)*2 = 12
    # priority order: multiply then add -> (5*2)+1 = 11
    result = apply_simple_operations(data, request)
    assert result == pytest.approx([11.0])
