import numpy as np
import pytest

def test_simple_interpolation(interpolation_entry_path_directory):

    db_names = [f"imas:hdf5?path={interpolation_entry_path_directory}/interpolation_db_1",f"imas:hdf5?path={interpolation_entry_path_directory}/interpolation_db_2"]
    uri_fragment = "#equilibrium/time_slice[:]/profiles_2d[:]/psi"
    parameters = {
        "uri": f"{db_names[0]}/{uri_fragment}",
        "interpolate_over" : [f"{db_names[1]}/{uri_fragment}"]
    }
    response = pytest.test_client.get("/data/plot_data", params=parameters)

    assert response.status_code == 200

    json_data = response.json()["data"]
    coords = json_data["coordinates"]

    coord_shapes = [list(np.asarray(c['value']).shape) for c in coords]
    assert coord_shapes == [[4,4,12],[4,4,3],[4,4],[4]]

