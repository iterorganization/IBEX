import imas
import numpy as np
import pytest
from fastapi.testclient import TestClient

from ibex.main import app

pytest.test_client = TestClient(app)


@pytest.fixture(scope="session")
def entry_path(tmp_path_factory):
    tmp_path = tmp_path_factory.mktemp("testdb")

    entry = imas.DBEntry(f"imas:hdf5?path={tmp_path}", mode="w")
    core_profiles = entry.factory.core_profiles()

    core_profiles.ids_properties.homogeneous_time = 1
    core_profiles.time = np.array([1.0, 2.0, 3.0, 4.0, 5.0])

    core_profiles.profiles_1d.resize(5)

    for aos_element, time_element in zip(core_profiles.profiles_1d, core_profiles.time):
        aos_element.time = time_element

    # ===== for error bars test =====
    core_profiles.vacuum_toroidal_field.r0 = 1.0
    core_profiles.vacuum_toroidal_field.r0_error_upper = 2.0
    core_profiles.vacuum_toroidal_field.r0_error_lower = 0.1

    # ===== for plot data 1...N coord test =====
    for profiles_1d in core_profiles.profiles_1d:
        profiles_1d.ion.resize(3)
        for ion in profiles_1d.ion:
            ion.z_ion = 1

    # ===== for 2D data =====
    core_profiles.profiles_2d.resize(5)

    i = 0
    for profiles_2d in core_profiles.profiles_2d:
        profiles_2d.ion.resize(2)
        for ion in profiles_2d.ion:
            ion.name = f"random ion name {i}"

            ion.temperature = np.array([[i, +1, i + 2], [i + 10, i + 11, i + 12], [i + 20, i + 21, i + 32]])
        profiles_2d.grid.dim1 = np.array([0, 1, 2])
        profiles_2d.grid.dim2 = np.array([0, 1, 2])
        i += 10

    entry.put(core_profiles)
    entry.close()

    return tmp_path
