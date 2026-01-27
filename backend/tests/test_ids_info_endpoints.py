import pytest


def test_node_info_coordinates(entry_path):
    test_dict = {
        "#core_profiles/profiles_1d": ["time"],
        "#core_profiles/profiles_1d[0]/ion[0]": ["1...N", "time"],
        "#core_profiles/profiles_1d[0]/grid/rho_tor": ["profiles_1d(itime)/grid/rho_tor_norm", "time"],
    }

    for path, coordinates in test_dict.items():
        parameters = {
            "uri": f"imas:hdf5?path={entry_path}{path}",
        }
        response = pytest.test_client.get("/ids_info/node_info", params=parameters)

        assert response.status_code == 200
        assert response.json()["coordinates"] == coordinates, (
            f"Testing path: {path}. "
            f"Received coordinate: {response.json()['coordinates']} does not match expected value: {coordinates}"
        )


def test_node_info_empty_path(entry_path):
    parameters = {
        "uri": f"imas:hdf5?path={entry_path}#core_profiles",
    }
    response = pytest.test_client.get("/ids_info/node_info", params=parameters)

    # test some core_profiles nodes
    root_children = [
        "ids_properties",
        "profiles_1d",
        "profiles_2d",
        "global_quantities",
        "time",
    ]
    response_children = [x["name"] for x in response.json()["children"]]

    assert response.status_code == 200
    assert set(root_children).issubset(set(response_children))


def test_find_paths(entry_path):
    parameters = {
        "uri": f"imas:hdf5?path={entry_path}",
        "searched_node": "version_put",
    }
    response = pytest.test_client.get("/ids_info/find_paths", params=parameters)

    assert response.status_code == 200
    assert response.json()["paths"] == [
        "#core_profiles/ids_properties/version_put/data_dictionary",
        "#core_profiles/ids_properties/version_put/access_layer",
        "#core_profiles/ids_properties/version_put/access_layer_language",
    ]


def test_array_summary(entry_path):
    parameters = {
        "uri": f"imas:hdf5?path={entry_path}#core_profiles/time",
    }
    response = pytest.test_client.get("/ids_info/array_summary", params=parameters)

    assert response.status_code == 200
    assert response.json()["shape"] == [5]
    assert response.json()["min"] == 1.0
    assert response.json()["max"] == 5.0
    assert response.json()["mean"] == 3.0


def test_show_error_bars_option(entry_path):
    parameters = {
        "uri": f"imas:hdf5?path={entry_path}#core_profiles/vacuum_toroidal_field",
        "show_error_bars": False,
    }
    response = pytest.test_client.get("/ids_info/node_info", params=parameters)

    assert response.status_code == 200
    for child in response.json()["children"]:
        assert not any(
            x in child["name"] for x in ["_error_upper", "_error_lower", "_error_index"]
        ), f"Error bars filtering failed. Node {child['name']} should not be returned."

    parameters = {"uri": f"imas:hdf5?path={entry_path}#core_profiles/vacuum_toroidal_field", "show_error_bars": True}
    response = pytest.test_client.get("/ids_info/node_info", params=parameters)
    assert response.status_code == 200
    assert "r0_error_upper" in [
        child["name"] for child in response.json()["children"]
    ], "Error bars filtering failed. 'r0_error_upper' nodes was not returned, but it should be."
