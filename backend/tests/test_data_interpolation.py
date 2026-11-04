from itertools import permutations

import imas
import numpy as np
import pytest
from ibex.data_source.imas_python_source_utils import (
    resample_data_with_interpolation,
    resample_data_without_interpolation,
)


IDS_TIME_BASES = {
    "summary:0/global_quantities/ip/value": np.linspace(0.0, 1.0, 11),
    "core_profiles:0/global_quantities/ip": np.asarray([0.05, 0.5, 1.5]),
    "equilibrium:0/time_slice[:]/global_quantities/ip": np.asarray([0.25, 0.75]),
    # heterogeneous time: the time of each slice is in time_slice[:]/time
    "equilibrium:1/time_slice[:]/global_quantities/ip": np.asarray([0.3, 2.0]),
}


@pytest.fixture(scope="session")
def ids_time_bases_entry_path(tmp_path_factory):
    """One entry where ip is in several IDSs, each on its own time vector (see IDS_TIME_BASES); ip = 1e6 + time."""
    uri = f"imas:hdf5?path={tmp_path_factory.mktemp('ids_time_bases_testdb')}/ids_time_bases_db"
    times = list(IDS_TIME_BASES.values())

    with imas.DBEntry(uri, mode="w") as entry:
        summary = entry.factory.summary()
        summary.ids_properties.homogeneous_time = 1
        summary.time = times[0]
        summary.global_quantities.ip.value = 1e6 + times[0]
        entry.put(summary)

        core_profiles = entry.factory.core_profiles()
        core_profiles.ids_properties.homogeneous_time = 1
        core_profiles.time = times[1]
        core_profiles.global_quantities.ip = 1e6 + times[1]
        core_profiles.profiles_1d.resize(len(times[1]))
        for profiles_1d in core_profiles.profiles_1d:
            profiles_1d.grid.rho_tor_norm = np.asarray([0.0, 0.5, 1.0])
            profiles_1d.electrons.temperature = np.asarray([3.0, 2.0, 1.0])
        entry.put(core_profiles)

        for occurrence, time in enumerate(times[2:]):
            equilibrium = entry.factory.equilibrium()
            equilibrium.ids_properties.homogeneous_time = 1 - occurrence
            if occurrence == 0:
                equilibrium.time = time
            equilibrium.time_slice.resize(len(time))
            for time_slice, slice_time in zip(equilibrium.time_slice, time):
                if occurrence == 1:
                    time_slice.time = slice_time
                time_slice.global_quantities.ip = 1e6 + slice_time
            entry.put(equilibrium, occurrence)

    return uri


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

        if method == "exact_value":
            assert response.status_code == 200

            json_data = response.json()["data"]
            coords = json_data["coordinates"]
            coord_shapes = [list(np.asarray(c["value"]).shape) for c in coords]
            assert coord_shapes == [[4, 4, 12], [4, 4, 3], [4, 4], [4]]
        else:
            # 1...N AoS are not supported by interpolation
            assert response.status_code == 466

    parameters["interpolation_method"] = "non-existing-method"
    response = pytest.test_client.get("/data/plot_data", params=parameters)
    assert response.status_code == 466


def test_interpolation_workflow2(interpolation_entry_path_directory):
    """
    This function tests only returned data shape. It doesn't check values.
    V2 of this function was added to fully check different case
    """
    db_names = [
        f"imas:hdf5?path={interpolation_entry_path_directory}/interpolation_db_1",
        f"imas:hdf5?path={interpolation_entry_path_directory}/interpolation_db_2",
    ]
    uri_fragment = "#equilibrium/time_slice[:]/coordinate_system/z"
    parameters = {"uri": f"{db_names[0]}/{uri_fragment}", "interpolate_over": [f"{db_names[1]}/{uri_fragment}"]}

    for method in ["linear", "slinear", "nearest"]:
        parameters["interpolation_method"] = method
        response = pytest.test_client.get("/data/plot_data", params=parameters)

        json_data = response.json()["data"]
        coords = json_data["coordinates"]
        coord_shapes = [list(np.asarray(c["value"]).shape) for c in coords]
        assert coord_shapes == [[4, 6, 7], [4, 6], [4]]


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


def test_interpolation_codes(interpolation_entry_path_directory):

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

    # test interpolation ...psi over ...psi_error_upper: only the coordinates of the target are used
    parameters = {
        "uri": f"{db_names[0]}/{uri_fragment}",
        "interpolate_over": [f"{db_names[1]}/{uri_fragment}_error_upper"],
    }
    response = pytest.test_client.get("/data/plot_data", params=parameters)
    assert response.status_code == 200

    # test interpolation ...psi_error_lower over ...psi_error_lower: the second node is empty, but its
    # coordinates still join the common ones, as when interpolating over the filled ...psi
    parameters = {
        "uri": f"{db_names[0]}/{uri_fragment}_error_lower",
        "interpolate_over": [f"{db_names[1]}/{uri_fragment}_error_lower"],
    }
    response = pytest.test_client.get("/data/plot_data", params=parameters)
    assert response.status_code == 200
    parameters["interpolate_over"] = [f"{db_names[1]}/{uri_fragment}"]
    response_over_filled = pytest.test_client.get("/data/plot_data", params=parameters)
    assert response_over_filled.status_code == 200
    coordinates = [c["value"] for c in response.json()["data"]["coordinates"]]
    assert coordinates == [c["value"] for c in response_over_filled.json()["data"]["coordinates"]]


@pytest.mark.parametrize("own, other", [(0, 1), (1, 0)])
def test_interpolation_over_another_occurrence(occurrences_entry_path, own, other):
    """
    Two occurrences of one IDS in one entry are drawn on the union of their time vectors,
    each value at its own time.
    """
    node = "global_quantities/ip/value"
    times = {0: np.linspace(0.0, 1.0, 11), 1: np.asarray([0.05, 0.5, 1.5])}
    parameters = {
        "uri": f"{occurrences_entry_path}#summary:{own}/{node}",
        "interpolate_over": [f"{occurrences_entry_path}#summary:{other}/{node}"],
        "interpolation_method": "exact_value",
    }
    response = pytest.test_client.get("/data/plot_data", params=parameters)
    assert response.status_code == 200

    data = response.json()["data"]
    union = np.union1d(times[0], times[1])
    np.testing.assert_allclose(data["coordinates"][0]["value"], union)

    value = np.asarray(data["value"], dtype=float)
    own_times = np.isin(union, times[own])
    np.testing.assert_allclose(value[own_times], 1e6 * (own + 1) + times[own])
    assert np.isnan(value[~own_times]).all()


def test_error_band_interpolation_over_another_occurrence(occurrences_entry_path):
    node = "global_quantities/ip/value"
    parameters = {
        "uri": f"{occurrences_entry_path}#summary:1/{node}_error_upper",
        "interpolate_over": [f"{occurrences_entry_path}#summary:0/{node}"],
        "interpolation_method": "exact_value",
    }
    response = pytest.test_client.get("/data/plot_data", params=parameters)
    assert response.status_code == 200
    assert len(response.json()["data"]["value"]) == 13


@pytest.mark.parametrize("own, other", list(permutations(range(len(IDS_TIME_BASES)), 2)))
def test_interpolation_over_another_ids(ids_time_bases_entry_path, own, other):
    """
    ip of several IDSs of one entry, each on its own time vector (equilibrium:1 with heterogeneous time),
    is drawn on the union of their time vectors, each value at its own time.
    """
    nodes = list(IDS_TIME_BASES)
    parameters = {
        "uri": f"{ids_time_bases_entry_path}#{nodes[own]}",
        "interpolate_over": [f"{ids_time_bases_entry_path}#{nodes[other]}"],
        "interpolation_method": "exact_value",
    }
    response = pytest.test_client.get("/data/plot_data", params=parameters)
    assert response.status_code == 200

    data = response.json()["data"]
    own_time, other_time = IDS_TIME_BASES[nodes[own]], IDS_TIME_BASES[nodes[other]]
    union = np.union1d(own_time, other_time)
    assert data["coordinates"][0]["name"] == "time"
    np.testing.assert_allclose(data["coordinates"][0]["value"], union)

    value = np.asarray(data["value"], dtype=float)
    own_times = np.isin(union, own_time)
    np.testing.assert_allclose(value[own_times], 1e6 + own_time)
    assert np.isnan(value[~own_times]).all()


def test_interpolation_over_another_ids_coordinates_mismatch(ids_time_bases_entry_path):
    """A node of another IDS whose coordinates differ from the node's cannot give it common coordinates."""
    parameters = {
        "uri": f"{ids_time_bases_entry_path}#summary/global_quantities/ip/value",
        "interpolate_over": [f"{ids_time_bases_entry_path}#core_profiles/profiles_1d[:]/electrons/temperature"],
        "interpolation_method": "exact_value",
    }
    response = pytest.test_client.get("/data/plot_data", params=parameters)
    assert response.status_code == 466
