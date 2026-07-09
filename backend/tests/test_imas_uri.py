import pytest
from ibex.core.utils import IMAS_URI
from ibex.data_source.exception import InvalidParametersException


def test_full_uri_with_all_parts():
    uri = IMAS_URI("imas:mdsplus?pulse=50101#core_profiles:1/profiles_1d[:]/time")
    assert uri.uri_entry_identifiers == "imas:mdsplus?pulse=50101"
    assert uri.uri_fragment == "core_profiles:1/profiles_1d[:]/time"
    assert uri.ids_name == "core_profiles"
    assert uri.occurrence == 1
    assert uri.node_path == "profiles_1d[:]/time"


def test_uri_without_occurrence():
    uri = IMAS_URI("imas:mdsplus?pulse=50101#core_profiles/profiles_1d[:]/time")
    assert uri.ids_name == "core_profiles"
    assert uri.occurrence == 0
    assert uri.node_path == "profiles_1d[:]/time"


def test_uri_without_node_path():
    uri = IMAS_URI("imas:mdsplus?pulse=50101#core_profiles:2")
    assert uri.ids_name == "core_profiles"
    assert uri.occurrence == 2
    assert uri.node_path == ""


def test_uri_with_ids_only():
    uri = IMAS_URI("imas:mdsplus?pulse=50101#core_profiles")
    assert uri.ids_name == "core_profiles"
    assert uri.occurrence == 0
    assert uri.node_path == ""


def test_uri_without_fragment():
    uri = IMAS_URI("imas:mdsplus?pulse=50101")
    assert uri.uri_entry_identifiers == "imas:mdsplus?pulse=50101"
    assert uri.uri_fragment == ""
    assert uri.ids_name == ""
    assert uri.occurrence == 0
    assert uri.node_path == ""


def test_uri_with_empty_occurrence():
    uri = IMAS_URI("imas:mdsplus?pulse=50101#core_profiles/profiles_1d[:]/time")
    assert uri.ids_name == "core_profiles"
    assert uri.occurrence == 0
    assert uri.node_path == "profiles_1d[:]/time"


def test_uri_with_non_numeric_occurrence():
    with pytest.raises(InvalidParametersException, match="Invalid IMAS URI fragment"):
        IMAS_URI("imas:mdsplus?pulse=50101#core_profiles:abc/profiles_1d[:]/time")


def test_uri_with_invalid_fragment():
    with pytest.raises(InvalidParametersException, match="Invalid IMAS URI fragment"):
        IMAS_URI("imas:mdsplus?pulse=50101#:1/path")


def test_uri_with_occurrence_zero():
    uri = IMAS_URI("imas:mdsplus?pulse=50101#core_profiles:0/profiles_1d[:]/time")
    assert uri.ids_name == "core_profiles"
    assert uri.occurrence == 0
    assert uri.node_path == "profiles_1d[:]/time"


def test_uri_with_large_occurrence():
    uri = IMAS_URI("imas:mdsplus?pulse=50101#core_profiles:999/path")
    assert uri.ids_name == "core_profiles"
    assert uri.occurrence == 999
    assert uri.node_path == "path"


def test_uri_with_node_path_containing_colon():
    uri = IMAS_URI("imas:mdsplus?pulse=50101#core_profiles:1/time_slice[:]/time")
    assert uri.ids_name == "core_profiles"
    assert uri.occurrence == 1
    assert uri.node_path == "time_slice[:]/time"
