from fastapi.testclient import TestClient
from ibex.main import app
from . import uris, uris_label


class TimeIdsInfoEndpointsSuite:
    param_names = uris_label
    params = uris

    def setup(self, *args):
        self.test_client = TestClient(app)

    def time_node_info(self, uri, node_path):
        parameters = {"uri": f"{uri}{node_path}"}
        self.test_client.get("/data_entry/node_info", params=parameters)

    time_node_info.param_names = param_names + ["node path"]
    time_node_info.params = (
        uris,
        [
            "#core_profiles:0/",  # IDS_BASE
            "#core_profiles:0/ids_properties",  # STRUCTURE
            "#core_profiles:0/ids_properties/version_put/access_layer",  # LEAF
            "#core_profiles:0/profiles_1d",  # AoS
            "#core_profiles:0/profiles_1d[0]",  # AoS element
            "#core_profiles:0/profiles_1d[0]/t_i_average",  # LEAF,
        ],
    )

    def time_find_field(self, uri, searched_node):
        parameters = {"uri": uri, "searched_node": searched_node}
        self.test_client.get("/data_entry/find_paths", params=parameters)

    time_find_field.param_names = param_names + ["searched node"]
    time_find_field.params = (uris, ["v_loop"])

    def time_array_summary(self, uri, node_path):
        parameters = {"uri": f"{uri}{node_path}"}
        self.test_client.get("/data_entry/array_summary", params=parameters)

    time_array_summary.param_names = param_names + ["node path"]
    time_array_summary.params = (
        uris,
        [
            "#core_profiles:0/profiles_1d[0]/t_i_average",
            "#core_profiles:0/time",
        ],
    )
