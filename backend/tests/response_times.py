import requests
import time
from functools import wraps
import numpy as np

server_port = 40443
server_address = f"http://127.0.0.1:{server_port}"


def timing(f):
    @wraps(f)
    def wrap(*args, **kw):
        ts = time.time()
        status_code, result = f(*args, **kw)
        te = time.time()
        print(f"============= {f.__name__} =============")
        print(f"    ARGS: {args}{kw}")
        print(f"    EXECUTION_TIME: {te - ts} sec")
        print(f"    RECEIVED ARRAY SHAPE: {result}")
        print(f"    STATUS CODE: {status_code}")
        print("==========================")
        return result

    return wrap


# @timing
def plot_data(uri):
    route = f"{server_address}/data/plot_data"
    params = {"uri": uri}
    result = requests.get(route, params=params)
    return (result.status_code, result.json()["data"]["shape"])


# @timing
def field_value(uri):
    route = f"{server_address}/data/field_value"
    params = {"uri": uri}
    result = requests.get(route, params=params)
    data_shape = list(np.asarray(result.json()["value"]).shape)
    return (result.status_code, data_shape)


if __name__ == "__main__":
    node_path = "#equilibrium/time_slice[:]/global_quantities/ip"

    # key: <number of slices>, value: <uri>
    uris = {
        245: "imas:mdsplus?pulse=135012;run=1;user=public;database=iter;version=3",
        984: "imas:mdsplus?pulse=135014;run=1;user=public;database=iter;version=3",
        11808: "imas:mdsplus?user=public;database=ITER;pulse=135009;run=5;version=3",
        70340: "imas:mdsplus?user=public;database=ITER;pulse=135010;run=5;version=3",
        127340: "imas:mdsplus?user=public;database=ITER;pulse=135002;run=5;version=3",
    }

    # for label, uri in uris.items():
    #    print(f"======================== {label} slices ========================")
    #    plot_data(f"{uri}{node_path}")
    #    field_value(f"{uri}{node_path}")

    # TEST DIFFERENT COUNT OF SLICES
    print()
    print("============= TESTING DIFFERENT COUNT OF SLICES =============")
    print()

    # pairs key: <minimum n_slices>, value: <slice_str>
    possible_slices = {
        1: "[0]",
        11: "[0:10]",
        101: "[0:100]",
        1001: "[0:1000]",
        10001: "[0:10000]",
        100001: "[0:100000]",
    }
    print("Time needed to extract data (#equilibrium/time_slice[:]/global_quantities/ip) :")
    print(f" n_slices{'   '.join([f'{x:5}' for x in possible_slices])}")
    for n_slices, uri in uris.items():
        print(f" {n_slices}   ".ljust(10), end="")
        for minimum_slices, slice in possible_slices.items():
            if n_slices < minimum_slices:
                print(" " * 13, end="")
                continue

            ts = time.time()
            field_value(f"{uri}{node_path.replace('[:]', slice)}")
            te = time.time()
            print(f"   {round(te - ts, 2)}".ljust(7), end="")
        print()
