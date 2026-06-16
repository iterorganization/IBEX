from functools import reduce

import numpy as np
from imas.ids_primitive import IDSNumericArray
from scipy.interpolate import RegularGridInterpolator
from scipy.ndimage import gaussian_filter
from scipy.signal import savgol_filter
from ibex.data_source.exception import InvalidParametersException


def apply_savgol_filter(
    data: list | np.ndarray,
    window_length: int | None,
    polyorder: int | None,
    deriv: int | None,
    delta: float | None,
    mode: str | None,
    cval: float | None,
):
    """
    Apply Savitzky-Golay filer to data
    :param data: The input array.
    :param window_length: The length of the filter window (i.e., the number of coefficients). If mode is ‘interp’, window_length must be less than or equal to the size of x.
    :param polyorder: The order of the polynomial used to fit the samples. polyorder must be less than window_length.
    :param deriv: The order of the derivative to compute. This must be a nonnegative integer. The default is 0, which means to filter the data without differentiating.
    :param delta: The spacing of the samples to which the filter will be applied. This is only used if deriv > 0. Default is 1.0.
    :param mode: Must be ‘mirror’, ‘constant’, ‘nearest’, ‘wrap’ or ‘interp’.
    :param cval: Value to fill past the edges of the input if mode is ‘constant’. Default is 0.0.

    :return: Data with filter applied
    """

    params = {
        "window_length": window_length,
        "polyorder": polyorder,
        "deriv": deriv,
        "delta": delta,
        "mode": mode,
        "cval": cval,
    }
    non_empty_params = {k: v for k, v in params.items() if v is not None}

    if isinstance(data, list):
        return [apply_savgol_filter(x, **params) for x in data]
    elif isinstance(data, (np.ndarray, IDSNumericArray)):
        return savgol_filter(data, **non_empty_params)
    else:
        msg = "Smoothing can be executed only on numeric arrays, not single values or strings."
        raise InvalidParametersException(msg)


def apply_gaussian_filter(data: list | np.ndarray, sigma):
    """
    Apply Gaussian filer to data
    :param data: The input array.
    :param sigma: Standard deviation for Gaussian kernel. The standard deviations of the Gaussian filter are given for each axis as a sequence, or as a single number, in which case it is equal for all axes.
    :return: Data with filter applied
    """
    if isinstance(data, list):
        return [apply_gaussian_filter(x, sigma) for x in data]
    elif isinstance(data, (np.ndarray, IDSNumericArray)):
        return gaussian_filter(data, sigma=sigma)
    else:
        msg = "Smoothing can be executed only on numeric arrays, not single values or strings."
        raise InvalidParametersException(msg)


def _safe_division(data, divisor):
    if isinstance(divisor, np.ndarray):
        if np.any(divisor == 0):
            raise InvalidParametersException("Division by zero is not allowed")
    elif divisor == 0:
        raise InvalidParametersException("Division by zero is not allowed")
    return data / divisor


def apply_simple_operations(data: list | np.ndarray, operations: list[str]):
    """
    Apply simple scalar operations to data in the order given.
    Each operation is a string in the format 'type:value', e.g. 'add:10', 'mul:5'.
    :param data: Input data
    :param operations: List of operations and operands divided by colon (:)
    :return: Data after operation
    """
    _OP_FUNCS = {
        "add": lambda r, v: r + v,
        "sub": lambda r, v: r - v,
        "mul": lambda r, v: r * v,
        "div": lambda r, v: _safe_division(r, v),
        "pow": lambda r, v: np.power(r, v),
        "root": lambda r, v: np.power(r, 1 / v),
    }

    if isinstance(data, list):
        return [apply_simple_operations(x, operations) for x in data]
    elif isinstance(data, (np.ndarray, IDSNumericArray)):
        result = data
        for op_str in operations:
            op_type, value_str = op_str.split(":", 1)
            value = float(value_str)
            func = _OP_FUNCS.get(op_type)
            if func is None:
                raise InvalidParametersException(f"Unknown operation type: {op_type}")
            result = func(result, value)
        return result
    else:
        msg = "Simple operations can be executed only on numeric arrays, not single values or strings."
        raise InvalidParametersException(msg)


def apply_signal_operations(data: list | np.ndarray, plot_data_query: Any, signal_data_by_uri: dict):
    """
    Apply signal operations to data.

    :param data: The input data array.
    :param plot_data_query: Request model with signal URI fields.
    :param signal_data_by_uri: Dict mapping signal URIs to their interpolated data arrays.
    """
    # signal_data_by_uri: {
    #   uri : <uri>
    #   data : <ids_data>
    #   interpolated_data : <data with shape of argument "data">
    # }

    _SIGNAL_OPERATION_DEFS = [
        ("signal_addition_addend_uri", "signal_addition_priority", 1, lambda r, v: r + v),
        ("signal_subtraction_subtrahend_uri", "signal_subtraction_priority", 2, lambda r, v: r - v),
        ("signal_multiplication_factor_uri", "signal_multiplication_priority", 3, lambda r, v: r * v),
        ("signal_division_divisor_uri", "signal_division_priority", 4, lambda r, v: _safe_division(r, v)),
    ]

    operations = []
    for uri_field, priority_field, default_priority, func in _SIGNAL_OPERATION_DEFS:
        uris = getattr(plot_data_query, uri_field)
        if uris:
            for uri in uris:
                priority = getattr(plot_data_query, priority_field) or default_priority
                signal_data = signal_data_by_uri[uri]
                operations.append({"priority": priority, "func": func, "value": signal_data})

    for op in sorted(operations, key=lambda x: x["priority"]):
        data = op["func"](data, op["value"])
    return data


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


def calculate_coordinate_shapes(shape: list[int], dims: int, n_coords: int):
    """
    Generate shapes for coordinate arrays based on a full data shape.

    :param shape: Full shape of the data array (e.g. [4, 5, 10, 15]).
    :param dims: Number of base dimensions extracted from Data Dictionary (e.g. 2 for a 2D grid -> [4, 5]).
    :param n_coords: Number of coordinate dimensions generated by AoS presence in node path (e.g. [10, 15]).
    :return: List of shapes for each coordinate. Includes:

    :raises ValueError: If ``len(shape) != dims + n_coords``.

    """

    if dims < 0 or dims >= len(shape):
        raise ValueError("dims must be >= 0 and < len(shape)")

    # Base dimensions (dimensions added by AoS in path), e.g. [4, 5]
    base = shape[:dims]
    # Remaining dimensions are coordinate dimensions, e.g. [10, 15]
    tail = shape[dims:]
    result = []

    # Create shapes for each coordinate dimension
    for size in reversed(tail):
        result.append(base + [size])

    # Add progressively reduced base shapes
    for i in range(dims, 0, -1):
        result.append(shape[:i])

    return result


def expand(data: list, grid_shape: list):
    """
    Expands 1D data to a multidimensional grid using NumPy broadcasting.

    The function reshapes the input array and broadcasts it over the given
    grid dimensions so that the result matches the original coordinate shape (un-flattened).

    :param data: 1D input array of shape (N,)
    :param grid_shape: target grid shape (e.g. [4, 3, 5])
    :return: broadcasted array of shape ``(*grid_shape, N)``

    :raises ValueError: if input data is not 1-dimensional
    """
    data = np.asarray(data)

    if data.ndim != 1:
        raise ValueError("Input data must be 1-dimensional")

    reshaped = data.reshape((1,) * len(grid_shape) + (data.shape[0],))
    result = np.broadcast_to(reshaped, tuple(grid_shape) + (data.shape[0],))

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


def resample_data_with_interpolation(
    original_coords: list, data: list, target_coords: list, interpolation_method: str | None = None
):
    """
    Resamples data onto new set of coordinates.
    :param original_coords: List of original data coordinates.
    :param data: Nested n-dimensional data array.
    :param target_coords: List of target coordinates.
    :return: Resampled data array.
    """
    if not interpolation_method:
        interpolation_method = "linear"
    try:
        interpolator = RegularGridInterpolator(original_coords, data, bounds_error=False, method=interpolation_method)
    except ValueError as e:
        message = f"Invalid parameter passed to interpolator: {e}"
        raise InvalidParametersException(message) from None

    # build mesh grid (manipulate coordinates to be list of coordinates e.g. [[x1,y1,z1,h1...], [x2,y2,z2,h3...]])
    mesh = np.meshgrid(*target_coords, indexing="ij")
    points = np.stack(mesh, axis=-1).reshape(-1, len(target_coords))

    result = interpolator(points)

    # revert mesh shape
    result = result.reshape([len(c) for c in target_coords])

    return result


def resample_data_without_interpolation(original_coords, data, target_coords):
    """
    Fast exact resampling using dictionaries.
    Best for large grids / many dimensions.
    """

    # Create output array filled with NaN
    output_shape = []
    for target in target_coords:
        output_shape.append(len(target))

    result = np.full(output_shape, np.nan, dtype=float)

    # Build target indices for each axis
    target_indices = []

    for orig, target in zip(original_coords, target_coords):
        # Build dictionary: coordinate -> target index
        lookup = {}
        for i, value in enumerate(target):
            lookup[value] = i

        axis_indices = []

        for value in orig:
            axis_indices.append(lookup[value])

        target_indices.append(axis_indices)

    # Create mesh
    mesh = np.meshgrid(*target_indices, indexing="ij")

    # Copy data
    result[tuple(mesh)] = data

    return result


def convert_ids_data_into_numpy_array(data: list):

    if isinstance(data, list):
        return [convert_ids_data_into_numpy_array(x) for x in data]
    elif isinstance(data, IDSNumericArray):
        return data.value
    else:
        return data
