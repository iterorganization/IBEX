import imas
import numpy as np
import pytest
from fastapi.testclient import TestClient

from ibex.main import app

pytest.test_client = TestClient(app)


@pytest.fixture(scope="session")
def interpolation_entry_path_directory(tmp_path_factory):
    tmp_path = tmp_path_factory.mktemp("interpolation_testdb")

    with imas.DBEntry(f"imas:hdf5?path={tmp_path}/interpolation_db_1", mode="w") as entry:
        eq = entry.factory.equilibrium()

        eq.ids_properties.homogeneous_time = 1
        eq.time = np.asarray([1, 2, 3, 4], dtype=float)
        eq.time_slice.resize(4)
        for ts in eq.time_slice:
            ts.profiles_1d.psi = np.asarray([1.0, 1.2, 1.3, 1.4, 1.5, 1.6])
            ts.profiles_1d.psi_error_upper = np.asarray([2.0, 2.0, 2.0, 2.0, 2.0, 2.0])
            ts.profiles_1d.psi_error_lower = np.asarray([0.5, 0.5, 0.5, 0.5, 0.5, 0.5])

            ts.profiles_2d.resize(2)
            for p2d in ts.profiles_2d:
                p2d.psi = np.asarray(np.random.rand(3, 3))
                p2d.grid.dim1 = np.asarray([1.0, 2.0, 3.0])
                p2d.grid.dim2 = np.asarray([1.0, 2.0, 3.0])
        entry.put(eq)

    with imas.DBEntry(f"imas:hdf5?path={tmp_path}/interpolation_db_2", mode="w") as entry:
        eq = entry.factory.equilibrium()

        eq.ids_properties.homogeneous_time = 1
        eq.time = np.asarray([1, 2, 3], dtype=float)
        eq.time_slice.resize(3)
        for ts in eq.time_slice:
            ts.profiles_1d.psi = np.asarray([1.8, 1.9, 2.0, 2.1])
            ts.profiles_1d.psi_error_upper = np.asarray([2.5, 2.5, 2.5, 2.5])
            # ts.profiles_1d.psi_error_lower = np.asarray([1.5,1.5,1.5,1.5])

            ts.profiles_2d.resize(4)
            for p2d in ts.profiles_2d:
                p2d.psi = np.asarray(np.random.rand(9, 3))
                p2d.grid.dim1 = np.asarray([0.3, 0.6, 0.9, 1.2, 1.5, 1.8, 2.1, 2.4, 2.7])
                p2d.grid.dim2 = np.asarray([1.0, 2.0, 3.0])
        entry.put(eq)
    return tmp_path


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

    # ===== for geometry overlay =====
    wall = entry.factory.wall()
    wall.ids_properties.homogeneous_time = 1
    wall.description_2d.resize(1)
    wall.description_2d[0].limiter.unit.resize(1)
    wall.description_2d[0].limiter.unit[0].outline.r = [1.0]
    wall.description_2d[0].limiter.unit[0].outline.z = [1.0]
    entry.put(wall)

    entry.close()

    return tmp_path
