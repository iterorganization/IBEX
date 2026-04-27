import numpy as np
import pytest


def test_simple_interpolation(interpolation_entry_path_directory):

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


def test_interpolation(interpolation_entry_path_directory):

    db_names = [
        f"imas:hdf5?path={interpolation_entry_path_directory}/interpolation_db_1",
        f"imas:hdf5?path={interpolation_entry_path_directory}/interpolation_db_2",
    ]
    uri_fragment = "#equilibrium/time_slice[:]/profiles_1d/psi"

    # test interpolation ...psi_error_upper over ...psi
    parameters = {
        "uri": f"{db_names[0]}/{uri_fragment}_error_upper",
        "interpolate_over": [f"{db_names[1]}/{uri_fragment}"],
    }
    response = pytest.test_client.get("/data/plot_data", params=parameters)
    assert response.status_code == 200

    # test interpolation ...psi over ...psi_error_upper (should return an error 466)
    parameters = {
        "uri": f"{db_names[0]}/{uri_fragment}",
        "interpolate_over": [f"{db_names[1]}/{uri_fragment}_error_upper"],
    }
    response = pytest.test_client.get("/data/plot_data", params=parameters)
    assert response.status_code == 466

    # test interpolation ...psi_error_lower over ...psi_error_lower (second node is empty - should return an error 464)
    parameters = {
        "uri": f"{db_names[0]}/{uri_fragment}_error_lower",
        "interpolate_over": [f"{db_names[1]}/{uri_fragment}_error_lower"],
    }
    response = pytest.test_client.get("/data/plot_data", params=parameters)
    assert response.status_code == 464
