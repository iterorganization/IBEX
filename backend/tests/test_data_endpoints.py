import pytest


def test_status_codes(entry_path):
    """
    This test checks only status codes of responses for quick check for unhandled exceptions
    :param entry_path:
    :return:
    """
    uris = [f"imas:hdf5?path={entry_path}#core_profiles/time"]

    for uri in uris:
        parameters = {"uri": uri}
        response = pytest.test_client.get("/data/plot_data", params=parameters)
        assert response.status_code == 200, f"plot_data endpoint execution for uri: {uri}, returning: {response.json()}"


def test_field_value(entry_path):
    parameters = {
        "uri": f"imas:hdf5?path={entry_path}#core_profiles/time",
    }
    response = pytest.test_client.get("/data/field_value", params=parameters)

    assert response.status_code == 200
    assert response.json()["value"] == [1.0, 2.0, 3.0, 4.0, 5.0]


def test_get_multiple_values(entry_path):
    parameters = {
        "uri": f"imas:hdf5?path={entry_path}#core_profiles/profiles_1d[:]/time",
    }
    response = pytest.test_client.get("/data/field_value", params=parameters)

    assert response.status_code == 200
    assert response.json()["value"] == [1.0, 2.0, 3.0, 4.0, 5.0]


def test_get_non_existing_node(entry_path):
    parameters = {
        "uri": f"imas:hdf5?path={entry_path}#non_existing_ids/non_existing_path",
    }
    response = pytest.test_client.get("/data/field_value", params=parameters)

    assert response.status_code == 404


def test_plot_data(entry_path):
    parameters = {
        "uri": f"imas:hdf5?path={entry_path}#core_profiles/profiles_1d[:]/time",
    }
    response = pytest.test_client.get("/data/plot_data", params=parameters)
    response_body = response.json()

    assert response.status_code == 200

    assert response_body["data"]["name"] == "time"
    assert response_body["data"]["unit"] == "s"
    assert response_body["data"]["shape"] == [5]
    assert response_body["data"]["path"] == "#core_profiles/profiles_1d[:]/time"

    assert len(response_body["data"]["coordinates"]) == 1
    time_coordinate = response_body["data"]["coordinates"][0]

    assert time_coordinate["name"] == "time"
    assert time_coordinate["target"] == "#core_profiles/profiles_1d[:]"
    assert time_coordinate["unit"] == "s"
    assert time_coordinate["shape"] == [5]
    assert time_coordinate["path"] == "#core_profiles/time"
    assert time_coordinate["description"] == "Generic time"


def test_plot_data_2d(entry_path):
    parameters = {
        "uri": f"imas:hdf5?path={entry_path}#core_profiles/profiles_2d[:]/ion[:]/temperature",
    }
    response = pytest.test_client.get("/data/plot_data", params=parameters)
    response_body = response.json()
    assert response.status_code == 200

    assert response_body["data"]["name"] == "temperature"
    assert response_body["data"]["unit"] == "eV"
    assert response_body["data"]["shape"] == [5, 2, 3, 3]
    assert response_body["data"]["path"] == "#core_profiles/profiles_2d[:]/ion[:]/temperature"

    assert len(response_body["data"]["coordinates"]) == 4

    time_coordinate = response_body["data"]["coordinates"][3]
    assert time_coordinate["name"] == "time"
    assert time_coordinate["target"] == "#core_profiles/profiles_2d[:]"
    assert time_coordinate["unit"] == "s"
    assert time_coordinate["shape"] == [5]
    assert time_coordinate["path"] == "#core_profiles/time"
    assert time_coordinate["description"] == "Generic time"

    dim1_coordinate = response_body["data"]["coordinates"][0]
    assert dim1_coordinate["name"] == "dim1"
    assert dim1_coordinate["target"] == "#core_profiles/profiles_2d[:]/ion[:]/temperature"
    assert dim1_coordinate["shape"] == [5, 3]
    assert dim1_coordinate["path"] == "#core_profiles/profiles_2d[:]/grid/dim1"

    dim2_coordinate = response_body["data"]["coordinates"][1]
    assert dim2_coordinate["name"] == "dim2"
    assert dim2_coordinate["target"] == "#core_profiles/profiles_2d[:]/ion[:]/temperature"
    assert dim2_coordinate["shape"] == [5, 3]
    assert dim2_coordinate["path"] == "#core_profiles/profiles_2d[:]/grid/dim2"


def test_plot_data_1_N_coord(entry_path):
    parameters = {
        "uri": f"imas:hdf5?path={entry_path}#core_profiles/profiles_1d[:]/ion[:]/z_ion",
    }
    response = pytest.test_client.get("/data/plot_data", params=parameters)
    response_body = response.json()

    assert response.status_code == 200

    numeric_coordinate = response_body["data"]["coordinates"][0]
    assert numeric_coordinate["name"] == "ion"
    assert numeric_coordinate["target"] == "#core_profiles/profiles_1d[:]/ion[:]"
    assert numeric_coordinate["unit"] == ""
    assert numeric_coordinate["shape"] == [5, 3]
    assert numeric_coordinate["ndim"] == 1
    assert numeric_coordinate["path"] == ""
    assert numeric_coordinate["description"] == "1...N"
