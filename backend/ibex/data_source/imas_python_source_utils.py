from functools import reduce

import numpy as np
from imas.ids_primitive import IDSNumericArray
from scipy.interpolate import LinearNDInterpolator


def union_arrays(data : list):
        return reduce(np.union1d, data)

def join_coordinates(a, b):
    """
    Joins N-dimensional coordinate arrays together. Assumes data is np.ndarray or IDSNumericArray
    :param a: left side of join - list or np.ndarray
    :param b: right side of join - list or np.ndarray
    :return: joined list
    """

    # merge np arrays
    if isinstance(a, (IDSNumericArray,np.ndarray)) and isinstance(b, (IDSNumericArray,np.ndarray)):
        return np.unique(np.concatenate((a, b), axis=0))

    # if a and b are lists → join them and
    if isinstance(a, list) and isinstance(b, list):
        max_len = max(len(a), len(b))
        result = []

        for i in range(max_len):
            if i < len(a) and i < len(b):
                result.append(join_coordinates(a[i], b[i]))
            elif i < len(a):
                result.append(a[i])
            else:
                result.append(b[i])

        return result

    if a is None:
        return b
    if b is None:
        return a

    raise TypeError(f"Different data types when merging coordinates during data interpolation: {type(a)} vs {type(b)}")

def resample_data(data, original_x, target_x):

    if isinstance(data, list):
        return [resample_data(x, original_x, target_x) for x in data]
    elif isinstance(data, IDSNumericArray):
        return np.interp(target_x, original_x, data.value, left=np.nan, right=np.nan)
    elif isinstance(data, np.ndarray):
        return np.interp(target_x, original_x, data, left=np.nan, right=np.nan)
    else:
        return data

def resample_data2(data1, original_coords, target_coords):

    # time_slice(itime)/profiles_2d(i1)/psi
    # 1- time_slice(itime)/profiles_2d(i1)/grid/dim1
    # 2- time_slice(itime)/profiles_2d(i1)/grid/dim2

    # class LinearNDInterpolator(points, values, fill_value=np.nan, rescale=False)
    # interp = LinearNDInterpolator(list(zip(x, y)), z)

    interp = LinearNDInterpolator(original_coords, data1)
    result = interp(target_coords, data1)

    print(f"==== RESULT {result}")
    return result

def convert_ids_data_into_numpy_array(data: list):

    if isinstance(data, list):
        return [convert_ids_data_into_numpy_array(x) for x in data]
    elif isinstance(data, IDSNumericArray):
        return data.value
    else:
        return data