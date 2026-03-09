from functools import reduce

import numpy as np
from imas.ids_primitive import IDSNumericArray
from scipy.interpolate import RegularGridInterpolator


def union_arrays(data: list):
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
    """
    Returns shape of irregular array. Result contains maximum array length in every dimension.
    :param lst: input array
    :return:
    """
    if shape is None:
        shape = []

    if isinstance(lst, (list, np.ndarray)):
        if len(shape) <= level:
            shape.append(0)
        shape[level] = max(shape[level], len(lst))

        for item in lst:
            get_max_shape(item, level + 1, shape)

    return shape


def fill_array(arr, lst, index=()):
    """
    Recursively fills an array with values from a nested list.

    :param arr: Array-like object supporting tuple indexing.
    :param lst: Nested list with values to insert into the array.
    :param index: Current index used during recursion.
    :return: None (modifies arr in place).
    """
    if isinstance(lst, list):
        for i, item in enumerate(lst):
            fill_array(arr, item, index + (i,))
    else:
        arr[index] = lst


def pad_to_rectangular(lst):
    """
    Converts a nested list into a rectangular NumPy array by padding
    missing values with NaN.

    :param lst: Nested list with uneven lengths.
    :return: NumPy array with NaN padding.
    """
    shape = tuple(get_max_shape(lst))
    arr = np.full(shape, np.nan)
    fill_array(arr, lst)
    return arr


def resample_data(original_coords: list, data: list, target_coords: list):
    """
    Resamples data onto new set of coordinates.
    :param original_coords: List of original data coordinates.
    :param data: Nested n-dimensional data array.
    :param target_coords: List of target coordinates.
    :return: Resampled data array.
    """
    interpolator = RegularGridInterpolator(original_coords, data, bounds_error=False)

    # build mesh grid (manipulate coordinates to be list of coordinates e.g. [[x1,y1,z1,h1...], [x2,y2,z2,h3...]])
    mesh = np.meshgrid(*target_coords, indexing="ij")
    points = np.stack(mesh, axis=-1).reshape(-1, len(target_coords))

    result = interpolator(points)

    # revert mesh shape
    result = result.reshape([len(c) for c in target_coords])

    return result


def convert_ids_data_into_numpy_array(data: list):

    if isinstance(data, list):
        return [convert_ids_data_into_numpy_array(x) for x in data]
    elif isinstance(data, IDSNumericArray):
        return data.value
    else:
        return data
