from fastapi.testclient import TestClient
from ibex.main import app
from . import uris, uris_label


class TimeDataEndpointsSuite:
    param_names = uris_label
    params = uris
    timeout = 240

    def setup(self, *args):
        self.test_client = TestClient(app)

    def time_field_value(self, uri, node_path):
        parameters = {"uri": f"{uri}{node_path}"}
        self.test_client.get("/data/field_value", params=parameters)

    time_field_value.param_names = param_names + ["node path"]
    time_field_value.params = (
        uris,
        [
            "#core_profiles:0/time",  # LEAF
            "#core_profiles:0/profiles_1d[0]/t_i_average",  # LEAF IN AoS,
            "#core_profiles:0/profiles_1d[:]/t_i_average",  # LEAF IN AoS SLICE,
            "#equilibrium:0/time_slice[:]/profiles_2d[:]/psi",  # 2D QUANTITY,
        ],
    )

    def time_plot_data(self, uri, node_path):
        parameters = {"uri": f"{uri}{node_path}"}
        self.test_client.get("/data/plot_data", params=parameters)

    time_plot_data.param_names = param_names + ["node path"]
    time_plot_data.params = (
        uris,
        [
            "#core_profiles:0/time",  # LEAF
            "#core_profiles:0/profiles_1d[0]/t_i_average",  # LEAF IN AoS,
            "#core_profiles:0/profiles_1d[:]/t_i_average",  # LEAF IN AoS SLICE,
            "#equilibrium:0/time_slice[:]/profiles_2d[:]/psi",  # 2D QUANTITY,
        ],
    )
