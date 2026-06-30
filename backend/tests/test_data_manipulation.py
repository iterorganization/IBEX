import numpy as np
import pytest
from ibex.data_source.exception import InvalidParametersException
from ibex.data_source.imas_python_source_utils import (
    apply_gaussian_filter,
    apply_savgol_filter,
    apply_signal_operations,
    apply_simple_operations,
)


def test_apply_signal_operations_addition():
    addend_uri = "imas:hdf5?path=/dummy/interpolation_db_1#equilibrium/time_slice[:]/profiles_2d[:]/psi"
    data = np.array([1.0, 2.0, 3.0])
    operations = [f"add:{addend_uri}"]
    signal_data_by_uri = {addend_uri: np.array([10.0, 20.0, 30.0])}
    result = apply_signal_operations(data, operations, signal_data_by_uri)
    assert np.allclose(result, [11.0, 22.0, 33.0])


def test_apply_signal_operations_subtraction():
    subtrahend_uri = "imas:hdf5?path=/dummy/interpolation_db_2#equilibrium/time_slice[:]/profiles_2d[:]/psi"
    data = np.array([10.0, 20.0, 30.0])
    operations = [f"sub:{subtrahend_uri}"]
    signal_data_by_uri = {subtrahend_uri: np.array([1.0, 2.0, 3.0])}
    result = apply_signal_operations(data, operations, signal_data_by_uri)
    assert np.allclose(result, [9.0, 18.0, 27.0])


def test_apply_signal_operations_multiplication():
    factor_uri = "imas:hdf5?path=/dummy/interpolation_db_1#equilibrium/time_slice[:]/profiles_2d[:]/psi"
    data = np.array([1.0, 2.0, 3.0])
    operations = [f"mul:{factor_uri}"]
    signal_data_by_uri = {factor_uri: np.array([2.0, 3.0, 4.0])}
    result = apply_signal_operations(data, operations, signal_data_by_uri)
    assert np.allclose(result, [2.0, 6.0, 12.0])


def test_apply_signal_operations_division():
    divisor_uri = "imas:hdf5?path=/dummy/interpolation_db_2#equilibrium/time_slice[:]/profiles_2d[:]/psi"
    data = np.array([10.0, 20.0, 30.0])
    operations = [f"div:{divisor_uri}"]
    signal_data_by_uri = {divisor_uri: np.array([2.0, 5.0, 6.0])}
    result = apply_signal_operations(data, operations, signal_data_by_uri)
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
    ("operations", "data", "expected"),
    [
        (["add:2"], np.array([1.0, 2.0, 3.0]), np.array([3.0, 4.0, 5.0])),
        (["sub:1"], np.array([3.0, 4.0, 5.0]), np.array([2.0, 3.0, 4.0])),
        (["mul:3"], np.array([1.0, 2.0, 3.0]), np.array([3.0, 6.0, 9.0])),
        (["div:2"], np.array([2.0, 4.0, 6.0]), np.array([1.0, 2.0, 3.0])),
        (["pow:2"], np.array([2.0, 3.0, 4.0]), np.array([4.0, 9.0, 16.0])),
        (["root:2"], np.array([1.0, 4.0, 9.0]), np.array([1.0, 2.0, 3.0])),
    ],
)
def test_apply_simple_operations(operations, data, expected):
    assert np.asarray(expected) == pytest.approx(apply_simple_operations(data, operations))


def test_apply_simple_operations_recurses_over_lists():
    data = [np.array([1.0, 2.0]), np.array([3.0, 4.0])]
    result = apply_simple_operations(data, ["add:1", "mul:2", "add:3"])
    assert np.asarray(result[0]) == pytest.approx([7.0, 9.0])
    assert np.asarray(result[1]) == pytest.approx([11.0, 13.0])


def test_apply_simple_operations_uses_order():
    data = np.array([5.0])
    # mul then add -> (5*2)+1 = 11
    result = apply_simple_operations(data, ["mul:2", "add:1"])
    assert result == pytest.approx([11.0])
    # add then mul -> (5+1)*2 = 12
    result = apply_simple_operations(data, ["add:1", "mul:2"])
    assert result == pytest.approx([12.0])


def test_apply_signal_operations_uses_order():
    uri_a = "some/uri/a"
    uri_b = "some/uri/b"
    data = np.array([5.0])
    signal_data_by_uri = {uri_a: np.array([2.0]), uri_b: np.array([1.0])}
    # mul then add -> (5*2)+1 = 11
    result = apply_signal_operations(data, [f"mul:{uri_a}", f"add:{uri_b}"], signal_data_by_uri)
    assert result == pytest.approx([11.0])
    # add then mul -> (5+1)*2 = 12
    result = apply_signal_operations(data, [f"add:{uri_b}", f"mul:{uri_a}"], signal_data_by_uri)
    assert result == pytest.approx([12.0])


def test_apply_signal_operations_2D():
    uri = "some/uri"
    data = [np.array([1.0, 2.0]), np.array([3.0, 4.0])]
    signal_data_by_uri = {uri: np.array([2.0, 3.0])}
    result = apply_signal_operations(data, [f"add:{uri}", f"mul:{uri}"], signal_data_by_uri)
    assert np.asarray(result[0]) == pytest.approx([6.0, 15.0])
    assert np.asarray(result[1]) == pytest.approx([10.0, 21.0])


def test_apply_signal_operations_rejects_division_by_zero():
    uri = "some/uri"
    with pytest.raises(InvalidParametersException, match="Division by zero is not allowed"):
        apply_signal_operations(np.array([1.0]), [f"div:{uri}"], {uri: np.array([0.0])})
