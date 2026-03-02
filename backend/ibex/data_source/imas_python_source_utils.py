from functools import reduce

import numpy as np
from imas.ids_primitive import IDSNumericArray
from scipy.interpolate import LinearNDInterpolator, RegularGridInterpolator


def union_arrays(data : list):
        return reduce(np.union1d, data)

def flatten(lst):
    result = []
    for item in lst:
        if isinstance(item, list):
            result.extend(flatten(item))
        else:
            result.append(item)
    return result

def get_max_shape(lst, level=0, shape=None):
    if shape is None:
        shape = []

    if isinstance(lst, (list,np.ndarray)):
        if len(shape) <= level:
            shape.append(0)
        shape[level] = max(shape[level], len(lst))

        for item in lst:
            get_max_shape(item, level + 1, shape)

    return shape


def fill_array(arr, lst, index=()):
    if isinstance(lst, list):
        for i, item in enumerate(lst):
            fill_array(arr, item, index + (i,))
    else:
        arr[index] = lst


def pad_to_rectangular(lst):
    shape = tuple(get_max_shape(lst))
    arr = np.full(shape, np.nan)
    fill_array(arr, lst)
    return arr

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

def resample_data2(original_coords, data, target_coords):

    # time_slice(itime)/profiles_2d(i1)/psi
    # 1- time_slice(itime)/profiles_2d(i1)/grid/dim1
    # 2- time_slice(itime)/profiles_2d(i1)/grid/dim2

    # class LinearNDInterpolator(points, values, fill_value=np.nan, rescale=False)
    # interp = LinearNDInterpolator(list(zip(x, y)), z)

    print(f"=== RESAMPLE ORIGINAL COORDS: {original_coords}")
    print(f"=== RESAMPLE TARGET COORDS: {target_coords}")
    print(f"=== RESAMPLE INPUT DATA: {data}")
    interpolator = RegularGridInterpolator(original_coords, data)
    result = interpolator(target_coords)

    print(f"==== RESULT {result}")
    return result

def convert_ids_data_into_numpy_array(data: list):

    if isinstance(data, list):
        return [convert_ids_data_into_numpy_array(x) for x in data]
    elif isinstance(data, IDSNumericArray):
        return data.value
    else:
        return data