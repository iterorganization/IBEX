import numpy as np
from functools import reduce
from imas.ids_primitive import IDSNumericArray

def union_arrays(data : list):
        return reduce(np.union1d, data)

def resample_data(data, original_x, target_x):

    if isinstance(data, list):
        return [resample_data(x, original_x, target_x) for x in data]
    elif isinstance(data, IDSNumericArray):
        return np.interp(target_x, original_x, data.value, left=np.nan, right=np.nan)
    elif isinstance(data, np.ndarray):
        return np.interp(target_x, original_x, data, left=np.nan, right=np.nan)
    else:
        return data


def convert_ids_data_into_numpy_array(data: list):

    if isinstance(data, list):
        return [convert_ids_data_into_numpy_array(x) for x in data]
    elif isinstance(data, IDSNumericArray):
        return data.value
    else:
        return data