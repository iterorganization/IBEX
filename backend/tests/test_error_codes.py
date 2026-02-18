import pytest


def test_non_existing_ids_node_info():
    parameters = {"uri": "imas:hdf5?path=non_existing_path"}
    response = pytest.test_client.get("/ids_info/node_info", params=parameters)
    assert response.status_code == 404, (
        "node_info endpoint should return 404 when trying to open non existing pulsefile"
    )


def test_non_existing_ids_field_value():
    parameters = {"uri": "imas:hdf5?path=non_existing_path"}
    response = pytest.test_client.get("/data/field_value", params=parameters)
    assert response.status_code == 404, (
        "node_info endpoint should return 404 when trying to open non existing pulsefile"
    )


def test_non_existing_node_ids_info(entry_path):
    parameters = {"uri": f"imas:hdf5?path={entry_path}#core_profiles/non_existing_node"}
    response = pytest.test_client.get("/ids_info/node_info", params=parameters)
    assert response.status_code == 404, (
        "node_info endpoint should return 404 when trying to open non existing node path"
    )


def test_non_existing_node_field_value(entry_path):
    parameters = {"uri": f"imas:hdf5?path={entry_path}#core_profiles/non_existing_node"}
    response = pytest.test_client.get("/data/field_value", params=parameters)
    assert response.status_code == 404, (
        "node_info endpoint should return 404 when trying to open non existing node path"
    )


def test_result_too_long(entry_path):
    # TODO: Add test when response limit will be introduced
    # parameters = {"uri": f"imas:hdf5?path={entry_path}#core_profiles"}
    # response = pytest.test_client.get("/ids_info/find_paths", params=parameters)
    # assert response.status_code == 460
    ...


def test_node_is_not_leaf_field_value(entry_path):
    parameters = {"uri": f"imas:hdf5?path={entry_path}#core_profiles/ids_properties"}
    response = pytest.test_client.get("/data/field_value", params=parameters)
    assert response.status_code == 461, "field_value endpoint should return 461 when trying to get non leaf node"


def test_node_is_not_leaf_array_summary(entry_path):
    parameters = {"uri": f"imas:hdf5?path={entry_path}#core_profiles/ids_properties"}
    response = pytest.test_client.get("/ids_info/array_summary", params=parameters)
    assert response.status_code == 461, "field_value endpoint should return 461 when trying to get non leaf node"


def test_node_is_not_array(entry_path):
    parameters = {"uri": f"imas:hdf5?path={entry_path}#core_profiles/ids_properties/version_put/access_layer"}
    response = pytest.test_client.get("/ids_info/array_summary", params=parameters)
    assert response.status_code == 462, (
        "array_summary endpoint should return 462 when trying to get summary of non array node"
    )
