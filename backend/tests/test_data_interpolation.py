import numpy as np
import pytest
from ibex.data_source.imas_python_source_utils import (
    resample_data_with_interpolation,
    resample_data_without_interpolation,
)


def test_interpolation_workflow(interpolation_entry_path_directory):
    """
    This function tests only returned data shape. It doesn't check values.
    """
    db_names = [
        f"imas:hdf5?path={interpolation_entry_path_directory}/interpolation_db_1",
        f"imas:hdf5?path={interpolation_entry_path_directory}/interpolation_db_2",
    ]
    uri_fragment = "#equilibrium/time_slice[:]/profiles_2d[:]/psi"
    parameters = {"uri": f"{db_names[0]}/{uri_fragment}", "interpolate_over": [f"{db_names[1]}/{uri_fragment}"]}

    for method in ["exact_value", "linear", "slinear", "nearest"]:
        parameters["interpolation_method"] = method
        response = pytest.test_client.get("/data/plot_data", params=parameters)
        assert response.status_code == 200

        json_data = response.json()["data"]
        coords = json_data["coordinates"]
        coord_shapes = [list(np.asarray(c["value"]).shape) for c in coords]
        assert coord_shapes == [[4, 4, 12], [4, 4, 3], [4, 4], [4]]

    parameters["interpolation_method"] = "non-existing-method"
    response = pytest.test_client.get("/data/plot_data", params=parameters)
    assert response.status_code == 466


def test_resample_without_interpolation(interpolation_entry_path_directory):

    db_names = [
        f"imas:hdf5?path={interpolation_entry_path_directory}/interpolation_db_1",
        f"imas:hdf5?path={interpolation_entry_path_directory}/interpolation_db_2",
    ]
    uri_fragment = "#equilibrium/time_slice[:]/profiles_2d[:]/psi"
    parameters = {"uri": f"{db_names[0]}/{uri_fragment}", "interpolate_over": [f"{db_names[1]}/{uri_fragment}"]}
    response = pytest.test_client.get("/data/plot_data", params=parameters)

    assert response.status_code == 200

    json_data = response.json()["data"]
    coords = json_data["coordinates"]

    coord_shapes = [list(np.asarray(c["value"]).shape) for c in coords]
    assert coord_shapes == [[4, 4, 12], [4, 4, 3], [4, 4], [4]]


def test_resample_with_interpolation_function():
    # ================== 1D ==================
    data_1d = [1.0, 2.0, 3.0]
    coords_1d = [[0.0, 1.0, 2.0]]
    target_coords_1d = [[0.0, 0.5, 1.0, 1.5, 2.0, 2.5]]
    returned_data = resample_data_with_interpolation(
        original_coords=coords_1d, data=data_1d, target_coords=target_coords_1d
    )

    expected_returned_data = [1.0, 1.5, 2.0, 2.5, 3.0, np.nan]
    assert np.allclose(returned_data, expected_returned_data, equal_nan=True)

    # ================== 2D ==================
    data_2d = [[1.0, 2.0, 3.0], [4.0, 5.0, 6.0], [7.0, 8.0, 9.0]]
    coords_2d = [[0.0, 1.0, 2.0], [0.0, 1.0, 2.0]]
    target_coords_2d = [[0.0, 0.5, 1.0, 1.5, 2.0, 2.5], [0.0, 0.5, 1.0, 1.5, 2.0, 2.5]]
    returned_data = resample_data_with_interpolation(
        original_coords=coords_2d, data=data_2d, target_coords=target_coords_2d
    )

    expected_returned_data = [
        [1.0, 1.5, 2.0, 2.5, 3.0, np.nan],
        [2.5, 3.0, 3.5, 4.0, 4.5, np.nan],
        [4.0, 4.5, 5.0, 5.5, 6.0, np.nan],
        [5.5, 6.0, 6.5, 7.0, 7.5, np.nan],
        [7.0, 7.5, 8.0, 8.5, 9.0, np.nan],
        [np.nan, np.nan, np.nan, np.nan, np.nan, np.nan],
    ]
    assert np.allclose(returned_data, expected_returned_data, equal_nan=True)


def test_resample_without_interpolation_function():

    data_1d = [1.0, 2.0, 3.0]
    coords_1d = [[0.0, 1.0, 2.0]]
    target_coords_1d = [[0.0, 0.5, 1.0, 1.5, 2.0, 2.5]]
    returned_data = resample_data_without_interpolation(
        original_coords=coords_1d, data=data_1d, target_coords=target_coords_1d
    )

    expected_returned_data = [1.0, np.nan, 2.0, np.nan, 3.0, np.nan]
    assert np.allclose(returned_data, expected_returned_data, equal_nan=True)

    # ================== 2D ==================
    data_2d = [[1.0, 2.0, 3.0], [4.0, 5.0, 6.0], [7.0, 8.0, 9.0]]
    coords_2d = [[0.0, 1.0, 2.0], [0.0, 1.0, 2.0]]
    target_coords_2d = [[0.0, 0.5, 1.0, 1.5, 2.0, 2.5], [0.0, 0.5, 1.0, 1.5, 2.0, 2.5]]
    returned_data = resample_data_without_interpolation(
        original_coords=coords_2d, data=data_2d, target_coords=target_coords_2d
    )

    expected_returned_data = [
        [1.0, np.nan, 2.0, np.nan, 3.0, np.nan],
        [np.nan, np.nan, np.nan, np.nan, np.nan, np.nan],
        [4.0, np.nan, 5.0, np.nan, 6.0, np.nan],
        [np.nan, np.nan, np.nan, np.nan, np.nan, np.nan],
        [7.0, np.nan, 8.0, np.nan, 9.0, np.nan],
        [np.nan, np.nan, np.nan, np.nan, np.nan, np.nan],
    ]
    assert np.allclose(returned_data, expected_returned_data, equal_nan=True)
