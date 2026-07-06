import pytest


def test_interpolation_irregular_coordinate(interpolation_entry_path_directory):
    db_names = [
        f"imas:hdf5?path={interpolation_entry_path_directory}/interpolation_db_1",
        f"imas:hdf5?path={interpolation_entry_path_directory}/interpolation_db_2",
    ]
    uri_fragment = "#core_profiles:0/profiles_1d[:]/electrons/temperature"
    parameters = {
        "uri": f"{db_names[0]}/{uri_fragment}",
        "interpolate_over": [f"{db_names[1]}/{uri_fragment}"],
    }

    for method in ["exact_value", "linear", "slinear", "nearest"]:
        parameters["interpolation_method"] = method
        response = pytest.test_client.get("/data/plot_data", params=parameters)

        if method == "slinear":
            assert response.status_code == 464
        else:
            assert response.status_code == 200


def test_plot_data_profiles_2d(interpolation_entry_path_directory):
    db_names = [
        f"imas:hdf5?path={interpolation_entry_path_directory}/interpolation_db_1",
        f"imas:hdf5?path={interpolation_entry_path_directory}/interpolation_db_2",
    ]
    uri_fragment = "#core_profiles:0/profiles_2d[:]/ion[:]/temperature"
    parameters = {
        "uri": f"{db_names[0]}/{uri_fragment}",
        "interpolate_over": [f"{db_names[1]}/{uri_fragment}"],
        "interpolation_method": "exact_value",  # non time-based AoS are supported only by `exact_value` method
    }

    response = pytest.test_client.get("/data/plot_data", params=parameters)
    assert response.status_code == 200
