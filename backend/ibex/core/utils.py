from typing import List  # type: ignore
from enum import Enum  # type: ignore

from tsdownsample import MinMaxDownsampler, M4Downsampler, LTTBDownsampler, MinMaxLTTBDownsampler  # type: ignore
from imas.ids_primitive import IDSNumericArray
from ibex.data_source.exception import NotAnArrayException

import numpy as np  # type: ignore


def find_first_value_in_list(data: list):
    """
    Traverses multidimensional list and returns first non-list value found
    """
    if not isinstance(data, list):
        return data

    for element in data:
        if not isinstance(element, list):
            return element
        else:
            result = find_first_value_in_list(element)
            if result is not None:
                return result
    return None


def transform_2D_data(data: list | np.ndarray):
    """
    Takes multidimensional list as input and transforms all np.arrays it founds (https://numpy.org/doc/2.1/reference/generated/numpy.ndarray.T.html)
    :param data: multidimensional list of np.arrays
    """
    if isinstance(data, list):
        return [transform_2D_data(x) for x in data]
    if isinstance(data, (np.ndarray, IDSNumericArray)):
        return data.T
    else:
        raise NotAnArrayException(f"Cannot transpose non-array value. Argument type was {type(data)}")


def step_downsampling(data: IDSNumericArray, n_out: int, *args, **kwargs):
    """
    Takes data list as input, and returns list of indices to be used for downsampling.
    Utilizes step method returning every n-th index, where step is calculated as follows: step = len(data) / n_out.

    :param data: data to be down-sampled
    :param n_out: desired size of data after downsampling
    :param `*args`: unused argument
    :param `**kwargs`: unused argument

    """
    # Calculate step value for data
    # The same value is used for every dimension in order to maintain chart shape
    step = int(len(data) / n_out)
    ndim = data.ndim
    if step == 0:
        step = 1
    # * ... , operator unpacks generator into tuple
    slices = (*(slice(None, None, step) for _ in range(ndim)),)

    return slices


def step_average_downsampling(data: IDSNumericArray, n_out: int, x=None, *args, **kwargs):
    """
    Takes data list as input, and returns list of indices to be used for downsampling.
    Utilizes step-average method. Divides data into bind and counts average value of every bin.

    :param data: data to be down-sampled
    :param n_out: desired size of data after downsampling
    :param `*args`: unused argument
    :param `**kwargs`: unused argument

    """

    original_size = data.shape[0]
    if n_out <= 0 or n_out > original_size:
        return x, data

    step = original_size // n_out
    trimmed_size = step * n_out
    trimmed_data = data[:trimmed_size]

    new_shape = (n_out, step) + data.shape[1:]
    reshaped = trimmed_data.reshape(new_shape)

    result = reshaped.mean(axis=1)

    if x:
        x_indices = step_downsampling(x, n_out=n_out)
        x = np.asarray(x)[x_indices].tolist()
        # if len(x) != len(y):
        #    raise AttributeError(f"X and Y lenght differ!!! X LEN: {len(x)} ||| Y LEN: {len(y)}")

    return x, result


class DownsamplingMethods(Enum):
    """
    Enum class representing available downsampling methods.
    STEP and STEP_AVERAGE are implemented directly in ibex code, while MIN_MAX, M4, LTTB and MIN_MAX_LLTB methods are implemented in tsdownsample package (https://github.com/predict-idlab/tsdownsample).
    """

    NONE = {"name": "None", "description": "Downsampling disabled"}
    STEP = {
        "name": "Step",
        "description": "Returns every n-th element. N is calculated basing on desired data size",
        "function": step_downsampling,
    }
    STEP_AVERAGE = {
        "name": "Step average",
        "description": "Divides data into bins and return average value of every bin. Bin size is calculated basing on desired data size",
        "function": step_average_downsampling,
    }
    MIN_MAX = {
        "name": "Min-Max",
        "description": "Selects the minimum and maximum value in each bin",
        "function": MinMaxDownsampler().downsample,
    }
    M4 = {
        "name": "M4",
        "description": "Selects the minimum, maximum, first, and last value in each bin",
        "function": M4Downsampler().downsample,
    }
    LTTB = {
        "name": "LTTB",
        "description": "Implements the Largest Triangle Three Buckets (LTTB) algorithm",
        "function": LTTBDownsampler().downsample,
    }
    MIN_MAX_LTTB = {
        "name": "Min-Max LTTB",
        "description": "A two-step algorithm: first selects min and max values, then further reduces these using the LTTB algorithm",
        "function": MinMaxLTTBDownsampler().downsample,
    }

    @classmethod
    def _missing_(cls, name):
        if name is None:
            return cls.NONE
        for method in cls:
            if method.value["name"].lower() == name.lower().strip():
                return method
        raise ValueError(f"Downsampling method: {name} is not recognised by IBEX backend")


def downsample_data(data: List, target_size: int, method: str | None = None, x=None, single_x_axis=True):
    """
    Downsamples list of values
    :param data: data to be down-sampled
    :param target_size: desired size of data (in elements per dimension)
    :param method: Downsampling method. One of DownsamplingMethods (Enum) possible values or None
    :param x: x-axis values (coordinate) to be downsampled
    :param single_x_axis: determines if there is common x axis for all np.arrays in data (e.g. single time vector for all)

    Returns tuple (downsapled_coordinate, downsampled_data)
    """
    method = DownsamplingMethods(method)

    if method is None or method == DownsamplingMethods.NONE:
        return x, data

    # ====== handle multidimensional list of data (list of np.ndarrays) ======
    # this section just goes deeper and deeper into multidimensional list of data and calls downsample_data() recursively

    if isinstance(data, List):
        downsampled_x = []
        downsampled_data = []

        if single_x_axis or x is None:
            for _data in data:
                _x1, _data1 = downsample_data(_data, target_size, method, x=x)
                downsampled_x = _x1
                downsampled_data.append(_data1)
            if isinstance(downsampled_x, (np.ndarray, IDSNumericArray)):
                downsampled_x = downsampled_x.tolist()
            return downsampled_x or None, downsampled_data

        else:  # x is not None
            for _x, _data in zip(x, data):
                _x1, _data1 = downsample_data(_data, target_size, method, _x)
                downsampled_x.append(_x1)
                downsampled_data.append(_data1)
        return downsampled_x, downsampled_data

    if not isinstance(data, (IDSNumericArray, np.ndarray)):
        raise TypeError("Cannot downsample not-IDSNumericArray data")

    # ====== handle actual data (np.ndarray or IDSNumericArray) ======

    if DownsamplingMethods(method).value["name"] == "Step average":
        # Step average performs computation on data instead of just choosing indices, so we have to handle it separately
        return step_average_downsampling(data, n_out=target_size, x=x)

    downsampling_function = DownsamplingMethods(method).value["function"]

    s_ds = downsampling_function(data, n_out=target_size)

    if x is not None:
        try:
            return x[s_ds], data[s_ds]
        except IndexError:  # raised when X a scalar
            return x, data[s_ds]

    return x, data[s_ds]
