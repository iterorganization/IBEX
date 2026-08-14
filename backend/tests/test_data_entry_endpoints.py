from unittest.mock import patch

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


def test_entry_available_entries():
    fake_dbs = [("test_db", [(3, [("hdf5", {1: [(0, 0)]})])])]
    with patch(
        "ibex.data_source.imas_python_source.DBMaster.get_database_files",
        return_value=fake_dbs,
    ):
        response = pytest.test_client.get(
            "/data_entry/available_entries",
            params={"user": "public", "version": "3"},
        )

    assert response.status_code == 200
    assert response.json() == {"entries": ["imas:hdf5?user=public;pulse=1;run=0;database=test_db;version=3"]}
