import numpy as np
import pytest
from types import SimpleNamespace
from ibex.data_source.exception import InvalidParametersException
from ibex.data_source.imas_python_source_utils import (
    apply_gaussian_filter,
    apply_savgol_filter,
    apply_simple_operations,
)
from ibex.endpoints.schemas.request_data_schemas import PlotDataRequestModel


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
    request = SimpleNamespace(
        division_divisor=0,
        addition_addend=None,
        subtraction_subtrahend=None,
        multiplication_factor=None,
        exponentiation_exponent=None,
        root_degree=None,
    )

    with pytest.raises(InvalidParametersException, match="division_divisor cannot be 0"):
        apply_simple_operations(np.array([1.0, 2.0]), request)
