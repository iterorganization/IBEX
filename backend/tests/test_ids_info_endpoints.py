import pytest
import imas_core
import imas
from packaging.version import Version


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


@pytest.mark.skipif(
    Version(imas_core.__version__) < Version("5.7") or Version(imas.__version__) < Version("2.2.2"),
    reason="List filled paths functionality requires IMAS-Core >= 5.7 and IMAS-Python >= 2.2.2",
)
def test_node_info_filled_paths(entry_path):
    parameters = {
        "uri": f"imas:hdf5?path={entry_path}#core_profiles",
    }
    response = pytest.test_client.get("/ids_info/node_info", params=parameters)

    # test some core_profiles nodes
    children_has_data = {
        "ids_properties": True,
        "profiles_1d": True,
        "profiles_2d": True,
        "global_quantities": False,
        "time": True,
    }

    json_dict = response.json()
    assert response.status_code == 200
    assert json_dict["has_data"]
    for child in json_dict["children"]:
        try:
            assert child["has_data"] == children_has_data[child["name"]]
        except KeyError:
            # child node not used in this test
            ...


def test_find_paths(entry_path):
    parameters = {
        "uri": f"imas:hdf5?path={entry_path}",
        "searched_node": "version_put",
    }
    response = pytest.test_client.get("/ids_info/find_paths", params=parameters)

    assert response.status_code == 200
    if Version(imas_core.__version__) < Version("5.7") or Version(imas.__version__) < Version("2.2.2"):
        has_data_true = None  # before AL-Core 5.7 IBEX returns None
    else:
        has_data_true = True

    assert response.json()["paths"] == [
        {"path": "#core_profiles/ids_properties/version_put/data_dictionary", "has_data": has_data_true},
        {"path": "#core_profiles/ids_properties/version_put/access_layer", "has_data": has_data_true},
        {"path": "#core_profiles/ids_properties/version_put/access_layer_language", "has_data": has_data_true},
        {"path": "#wall/ids_properties/version_put/data_dictionary", "has_data": has_data_true},
        {"path": "#wall/ids_properties/version_put/access_layer", "has_data": has_data_true},
        {"path": "#wall/ids_properties/version_put/access_layer_language", "has_data": has_data_true},
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
        assert not any(x in child["name"] for x in ["_error_upper", "_error_lower", "_error_index"]), (
            f"Error bars filtering failed. Node {child['name']} should not be returned."
        )

    parameters = {"uri": f"imas:hdf5?path={entry_path}#core_profiles/vacuum_toroidal_field", "show_error_bars": True}
    response = pytest.test_client.get("/ids_info/node_info", params=parameters)
    assert response.status_code == 200
    assert "r0_error_upper" in [child["name"] for child in response.json()["children"]], (
        "Error bars filtering failed. 'r0_error_upper' nodes was not returned, but it should be."
    )
