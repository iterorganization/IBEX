import pytest


def test_entry_exists(entry_path):
    parameters = {"uri": f"imas:hdf5?path={entry_path}"}
    response = pytest.test_client.get("/data_entry/exists", params=parameters)
    assert response.status_code == 200
    assert response.json() == {"exists": True}


def test_entry_list_idses(entry_path):
    parameters = {"uri": f"imas:hdf5?path={entry_path}"}
    response = pytest.test_client.get("/data_entry/list_idses", params=parameters)
    assert response.status_code == 200

    core_profiles_dict = next(x for x in response.json()["idses"] if x["name"] == "core_profiles")
    assert core_profiles_dict["occurrences"] == [0]


def test_entry_available_entries(entry_path):
    parameters = {"uri": f"imas:hdf5?path={entry_path}"}
    response = pytest.test_client.get("/data_entry/available_entries", params=parameters)

    assert response.status_code == 200
    # TODO: test when functionality will be ready
