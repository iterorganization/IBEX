import pytest
import numpy as np
from packaging.version import Version
import imas

_IMAS_GE_2_3 = Version(imas.__version__) >= Version("2.3.0")


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


def test_plot_data_with_gaussian_smoothing(entry_path):
    parameters = {
        "uri": f"imas:hdf5?path={entry_path}#core_profiles/global_quantities/ip",
        "smoothing_method": "gaussian_filter",
        "gaussian_smoothing_sigma": 1,
    }
    response = pytest.test_client.get("/data/plot_data", params=parameters)
    assert response.status_code == 200

    response_body = response.json()
    assert response_body["data"]["value"] == pytest.approx([1.42, 2.06, 3.0, 3.93, 4.57], 0.1)


def test_plot_data_with_gaussian_smoothing_2d(entry_path):
    parameters = {
        "uri": f"imas:hdf5?path={entry_path}#wall/global_quantities/electrons/particle_flux_from_wall",
        "smoothing_method": "gaussian_filter",
        "gaussian_smoothing_sigma": 1,
    }
    response = pytest.test_client.get("/data/plot_data", params=parameters)
    assert response.status_code == 200

    response_body = response.json()

    assert np.array(response_body["data"]["value"]) == pytest.approx(
        np.array([[1.0, 1.0, 1.0], [2.28, 1.59, 1.12], [1.64, 1.29, 1.06], [2.92, 1.88, 1.18], [2.28, 1.59, 1.12]]), 0.1
    )


def test_plot_data_with_savgol_smoothing(entry_path):
    parameters = {
        "uri": f"imas:hdf5?path={entry_path}#core_profiles/global_quantities/ip",
        "smoothing_method": "savitzky-golay_filter",
        "savgol_smoothing_window_length": 5,
        "savgol_smoothing_polyorder": 2,
    }
    response = pytest.test_client.get("/data/plot_data", params=parameters)
    assert response.status_code == 200

    response_body = response.json()
    assert response_body["data"]["value"] == pytest.approx([0.99, 2.0, 3.0, 4.0, 5.0], 0.1)


def test_plot_data_with_simple_operations(entry_path):
    # core_profiles.time = [1,2,3,4,5] (float)
    cases = [
        (
            {"operations": ["add:2", "mul:3"]},
            [9.0, 12.0, 15.0, 18.0, 21.0],
        ),
        (
            {"operations": ["mul:3", "add:2"]},
            [5.0, 8.0, 11.0, 14.0, 17.0],
        ),
        (
            {"operations": ["div:2"]},
            [0.5, 1.0, 1.5, 2.0, 2.5],
        ),
        (
            {"operations": ["pow:2"]},
            [1.0, 4.0, 9.0, 16.0, 25.0],
        ),
        (
            {"operations": ["root:2"]},
            [1.0, 1.41421356237, 1.73205080757, 2.0, 2.2360679775],
        ),
    ]

    for params, expected in cases:
        parameters = {"uri": f"imas:hdf5?path={entry_path}#core_profiles/time", **params}
        response = pytest.test_client.get("/data/plot_data", params=parameters)
        assert response.status_code == 200

        response_body = response.json()
        assert response_body["data"]["value"] == pytest.approx(expected)


def test_plot_data_with_simple_operations_errors(entry_path):
    operations = "root:0"
    parameters = {"uri": f"imas:hdf5?path={entry_path}#core_profiles/time", "operations": operations}
    response = pytest.test_client.get("/data/plot_data", params=parameters)
    assert response.status_code == 466

    operations = "div:0"
    parameters = {"uri": f"imas:hdf5?path={entry_path}#core_profiles/time", "operations": operations}
    response = pytest.test_client.get("/data/plot_data", params=parameters)
    assert response.status_code == 466

    operations = "dummy:0"
    parameters = {"uri": f"imas:hdf5?path={entry_path}#core_profiles/time", "operations": operations}
    response = pytest.test_client.get("/data/plot_data", params=parameters)
    assert response.status_code == 422

    operations = "add:string"
    parameters = {"uri": f"imas:hdf5?path={entry_path}#core_profiles/time", "operations": operations}
    response = pytest.test_client.get("/data/plot_data", params=parameters)
    assert response.status_code == 422

    operations = ":0"
    parameters = {"uri": f"imas:hdf5?path={entry_path}#core_profiles/time", "operations": operations}
    response = pytest.test_client.get("/data/plot_data", params=parameters)
    assert response.status_code == 422

    operations = "string:"
    parameters = {"uri": f"imas:hdf5?path={entry_path}#core_profiles/time", "operations": operations}
    response = pytest.test_client.get("/data/plot_data", params=parameters)
    assert response.status_code == 422

    operations = "string"
    parameters = {"uri": f"imas:hdf5?path={entry_path}#core_profiles/time", "operations": operations}
    response = pytest.test_client.get("/data/plot_data", params=parameters)
    assert response.status_code == 422

    operations = ""
    parameters = {"uri": f"imas:hdf5?path={entry_path}#core_profiles/time", "operations": operations}
    response = pytest.test_client.get("/data/plot_data", params=parameters)
    assert response.status_code == 422


def test_plot_data_smoothing_with_wrong_target_node(entry_path):
    parameters = {
        "uri": f"imas:hdf5?path={entry_path}#core_profiles/time",  # targeted quantity must be time-based
        "smoothing_method": "gaussian_filter",
        "gaussian_smoothing_sigma": 1,
    }
    response = pytest.test_client.get("/data/plot_data", params=parameters)
    assert response.status_code == 466


@pytest.mark.parametrize("expected_unit", ["m"] if _IMAS_GE_2_3 else ["mixed"])
def test_plot_data_2d(entry_path, expected_unit):
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
    assert dim1_coordinate["name"] == "R"  # alias for dim1
    assert dim1_coordinate["unit"] == expected_unit
    assert dim1_coordinate["target"] == "#core_profiles/profiles_2d[:]/ion[:]/temperature"
    assert dim1_coordinate["shape"] == [5, 3]
    assert dim1_coordinate["path"] == "#core_profiles/profiles_2d[:]/grid/dim1"

    dim2_coordinate = response_body["data"]["coordinates"][1]
    assert dim2_coordinate["name"] == "Z"  # alias for dim2
    assert dim2_coordinate["unit"] == expected_unit
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


def test_plot_data_requires_gaussian_sigma(entry_path):
    parameters = {
        "uri": f"imas:hdf5?path={entry_path}#core_profiles/profiles_1d[:]/time",
        "smoothing_method": "gaussian_filter",
    }
    response = pytest.test_client.get("/data/plot_data", params=parameters)

    assert response.status_code == 422
    assert "gaussian_smoothing_sigma is required" in response.text


def test_combined_features(entry_path, interpolation_entry_path_directory):
    """
    Single test exercising all data manipulation features:
    simple operations, smoothing, interpolation (exact_value), and signal operations.
    """
    # --- Part 1: simple ops + gaussian smoothing + signal ops (entry_path) ---
    db = f"imas:hdf5?path={entry_path}"
    parameters = {
        "uri": f"{db}#core_profiles/global_quantities/ip",
        "operations": ["add:2", "mul:3", f"add:{db}#core_profiles/global_quantities/ip"],
        "smoothing_method": "gaussian_filter",
        "gaussian_smoothing_sigma": 1,
    }
    response = pytest.test_client.get("/data/plot_data", params=parameters)
    assert response.status_code == 200

    response_body = response.json()
    # ip=[1..5]; gaussian sigma=1 -> G(ip); add:2, mul:3 -> (G(ip)+2)*3;
    # self-signal add operand is the smoothed (pre-operations) snapshot G(ip)
    # result = (G(ip)+2)*3 + G(ip) = 4*G(ip)+6
    assert response_body["data"]["value"] == pytest.approx(
        [11.7081638, 14.27128814, 18.0, 21.72871186, 24.2918362], 0.01
    )

    # --- Part 2: different simple ops + savgol smoothing + exact_value interpolation + signal ops ---
    db_names = [
        f"imas:hdf5?path={interpolation_entry_path_directory}/interpolation_db_1",
        f"imas:hdf5?path={interpolation_entry_path_directory}/interpolation_db_2",
    ]

    parameters = {
        "uri": f"{db_names[0]}#equilibrium/vacuum_toroidal_field/b0",
        "operations": ["mul:10", "pow:2", f"add:{db_names[1]}#equilibrium/vacuum_toroidal_field/b0"],
        "smoothing_method": "savitzky-golay_filter",
        "savgol_smoothing_window_length": 3,
        "savgol_smoothing_polyorder": 1,
        "interpolate_over": [f"{db_names[1]}#equilibrium/vacuum_toroidal_field/b0"],
        "interpolation_method": "exact_value",
    }
    response = pytest.test_client.get("/data/plot_data", params=parameters)
    assert response.status_code == 200

    response_body = response.json()
    # db_1 b0: [0.1,0.2,0.3,0.4] (smoothing runs first: savgol on linear data -> no change)
    # mul:10+pow:2 -> [1,4,9,16]
    # exact_value interpolation on union [1,2,3,4] -> no change
    # db_2 b0: [0.1,0.2,0.3]
    # resampled to [1,2,3,4] with exact_value: [0.1,0.2,0.3,None]
    # signal add propagates missing operand data: [1.1,4.2,9.3,None]
    values = response_body["data"]["value"]
    assert values[:3] == pytest.approx([1.1, 4.2, 9.3], 0.01)
    assert values[3] is None


def test_plot_data_requires_savgol_window_length_and_polyorder(entry_path):
    base_parameters = {
        "uri": f"imas:hdf5?path={entry_path}#core_profiles/profiles_1d[:]/time",
        "smoothing_method": "savitzky-golay_filter",
    }

    response = pytest.test_client.get("/data/plot_data", params=base_parameters)
    assert response.status_code == 422
    assert "savgol_smoothing_window_length is required" in response.text

    response = pytest.test_client.get(
        "/data/plot_data",
        params={**base_parameters, "savgol_smoothing_window_length": 5},
    )
    assert response.status_code == 422
    assert "savgol_smoothing_polyorder is required" in response.text


@pytest.mark.parametrize("expected_unit", [("m", "rad")] if _IMAS_GE_2_3 else [("mixed", "mixed")])
def test_plot_data_coordinate_aliases(entry_path, expected_unit):

    parameters = {
        "uri": f"imas:hdf5?path={entry_path}#core_profiles/profiles_2d[0]/grid/volume_element",
    }
    response = pytest.test_client.get("/data/plot_data", params=parameters)
    response_body = response.json()

    assert response.status_code == 200

    dim1_coordinate = response_body["data"]["coordinates"][0]
    assert dim1_coordinate["name"].lower() == "r"
    assert dim1_coordinate["unit"].lower() == expected_unit[0]

    parameters = {
        "uri": f"imas:hdf5?path={entry_path}#core_profiles/profiles_2d[1]/grid/volume_element",
    }
    response = pytest.test_client.get("/data/plot_data", params=parameters)
    response_body = response.json()

    assert response.status_code == 200

    dim1_coordinate = response_body["data"]["coordinates"][0]
    dim2_coordinate = response_body["data"]["coordinates"][1]
    assert dim1_coordinate["name"].lower() == "rho"
    assert dim1_coordinate["unit"].lower() == expected_unit[0]

    assert dim2_coordinate["name"].lower() == "theta"
    assert dim2_coordinate["unit"].lower() == expected_unit[1]


def test_plot_data_with_signal_operations_rejects_different_units(entry_path):
    parameters = {
        "uri": f"imas:hdf5?path={entry_path}#core_profiles/global_quantities/v_loop",
        "operations": [f"add:imas:hdf5?path={entry_path}#core_profiles/global_quantities/ip"],
    }
    response = pytest.test_client.get("/data/plot_data", params=parameters)
    assert response.status_code == 466
    assert "Cannot add signals with different units" in response.json()["message"]


@pytest.mark.parametrize(("operation", "expected_unit"), [("mul", "s*s"), ("div", "")])
def test_plot_data_with_signal_operations_updates_unit(entry_path, operation, expected_unit):
    uri = f"imas:hdf5?path={entry_path}#core_profiles/time"
    response = pytest.test_client.get(
        "/data/plot_data",
        params={"uri": uri, "operations": [f"{operation}:{uri}"]},
    )

    assert response.status_code == 200
    assert response.json()["data"]["unit"] == expected_unit


def test_plot_data_with_signal_operations_same_shape_different_uris(interpolation_entry_path_directory):
    db_names = [
        f"imas:hdf5?path={interpolation_entry_path_directory}/interpolation_db_1",
        f"imas:hdf5?path={interpolation_entry_path_directory}/interpolation_db_3",
    ]

    parameters = {
        "uri": f"{db_names[0]}#equilibrium/time_slice[0:2]/profiles_2d[0]/grid/dim2",
        "operations": [f"add:{db_names[1]}#equilibrium/time_slice[0:2]/profiles_2d[0]/grid/dim2"],
    }
    response = pytest.test_client.get("/data/plot_data", params=parameters)
    assert response.status_code == 200

    response_body = response.json()
    assert response_body["data"]["value"] == [[12.0, 24.0, 36.0], [12.0, 24.0, 36.0]]


def test_plot_data_with_signal_operations_and_interpolation(interpolation_entry_path_directory):
    db_names = [
        f"imas:hdf5?path={interpolation_entry_path_directory}/interpolation_db_1",
        f"imas:hdf5?path={interpolation_entry_path_directory}/interpolation_db_2",
    ]

    parameters = {
        "uri": f"{db_names[0]}#equilibrium/time",
        "operations": [f"add:{db_names[1]}#equilibrium/time"],
        "interpolate_over": [f"{db_names[1]}#equilibrium/time"],
    }
    response = pytest.test_client.get("/data/plot_data", params=parameters)
    assert response.status_code == 200

    # time1: [1, 2, 3, 4]
    # time2: [1, 2, 3]
    response_body = response.json()
    assert response_body["data"]["value"] == [2.0, 4.0, 6.0, None]
    assert response_body["data"]["shape"] == [4]
    assert response_body["data"]["downsampled_shape"] == [4]

    # reversed order
    parameters = {
        "uri": f"{db_names[1]}#equilibrium/time",
        "operations": [f"add:{db_names[0]}#equilibrium/time"],
        "interpolate_over": [f"{db_names[0]}#equilibrium/time"],
    }
    response = pytest.test_client.get("/data/plot_data", params=parameters)
    assert response.status_code == 200

    # time1: [1, 2, 3]
    # time2: [1, 2, 3, 4]
    response_body = response.json()
    assert response_body["data"]["value"] == [2.0, 4.0, 6.0, None]
    # Interpolation expands the source from three to four samples.
    assert response_body["data"]["shape"] == [4]
    assert response_body["data"]["downsampled_shape"] == [4]


def test_plot_data_with_signal_operations_and_interpolation_2d(interpolation_entry_path_directory):
    db_names = [
        f"imas:hdf5?path={interpolation_entry_path_directory}/interpolation_db_1",
        f"imas:hdf5?path={interpolation_entry_path_directory}/interpolation_db_2",
    ]

    parameters = {
        "uri": f"{db_names[0]}#equilibrium/time_slice[:]/profiles_2d[:]/psi",
        "operations": [f"add:{db_names[1]}#equilibrium/time_slice[:]/profiles_2d[:]/psi"],
        "interpolate_over": [f"{db_names[1]}#equilibrium/time_slice[:]/profiles_2d[:]/psi"],
    }
    response = pytest.test_client.get("/data/plot_data", params=parameters)
    assert response.status_code == 200
    response_body = response.json()

    data = np.array(response_body["data"]["value"], dtype=float)
    # data shape reflects common coordinates (reversed): [time, profiles_2d, dim2, dim1]
    assert data.shape == (4, 4, 3, 12)
    # db_1 and db_2 have disjoint valid dim1 locations after interpolation, so operand NaNs propagate.
    assert np.count_nonzero(~np.isnan(data)) == 0

    # ---- reversed: db_2 primary, db_1 operand ----
    parameters = {
        "uri": f"{db_names[1]}#equilibrium/time_slice[:]/profiles_2d[:]/psi",
        "operations": [f"add:{db_names[0]}#equilibrium/time_slice[:]/profiles_2d[:]/psi"],
        "interpolate_over": [f"{db_names[0]}#equilibrium/time_slice[:]/profiles_2d[:]/psi"],
    }
    response = pytest.test_client.get("/data/plot_data", params=parameters)
    assert response.status_code == 200
    response_body = response.json()

    data = np.array(response_body["data"]["value"], dtype=float)
    assert data.shape == (4, 4, 3, 12)
    # db_1 and db_2 have disjoint valid dim1 locations after interpolation, so operand NaNs propagate.
    assert np.count_nonzero(~np.isnan(data)) == 0
