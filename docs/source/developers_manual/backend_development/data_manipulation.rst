.. _`Data manipulation`:

======================
Data manipulation
======================

Introduction
-------------

The IBEX backend provides a range of data manipulation techniques that directly affect the shape and appearance of the resulting plots.
These operations are applied as part of the ``/data/plot_data/`` request flow and allow the backend to transform datasets before they are returned to the frontend.
The backend applies the manipulation stages in this order:

1. data smoothing
2. data interpolation
3. simple and signal operations (a single ordered ``operations`` list; scalar and signal entries can be interleaved)
4. downsampling

This means later stages operate on the output of earlier ones when the corresponding request parameters are enabled.

.. note::

   Simple and signal operations are applied after data interpolation and before downsampling.
   See the dedicated sections below for details.

Data smoothing
---------------

IBEX supports smoothing and denoising of returned datasets.
This functionality is intended for cases where the raw signal contains high-frequency noise and a filtered representation is preferred for visualization or analysis.

Configuration
~~~~~~~~~~~~~~

Data smoothing is configured through the ``smoothing_method`` parameter of the ``/data/plot_data/`` endpoint.
It is only accepted for nodes whose first coordinate is ``time``.
If a different first coordinate is used, the backend rejects the request with an invalid-parameters error.

At the moment, the backend supports the following smoothing methods:

* ``gaussian_filter``
* ``savitzky_golay_filter``

The full list of available methods and their parameters can be retrieved from the ``/info/data_manipulation_methods/`` endpoint.

Gaussian smoothing
~~~~~~~~~~~~~~~~~~~

The ``gaussian_filter`` method applies a Gaussian kernel to the returned data.
It requires the ``gaussian_smoothing_sigma`` parameter, which defines the standard deviation of the Gaussian kernel.


Savitzky-Golay smoothing
~~~~~~~~~~~~~~~~~~~~~~~~~

The ``savitzky_golay_filter`` method applies a Savitzky-Golay filter to the returned data.
This approach smooths the data while preserving local shape better than a simple Gaussian filter in many cases.

The following parameters are supported:

* ``savgol_smoothing_window_length``: required
* ``savgol_smoothing_polyorder``: required
* ``savgol_smoothing_deriv``: optional
* ``savgol_smoothing_delta``: optional
* ``savgol_smoothing_mode``: optional, one of ``mirror``, ``constant``, ``nearest``, ``wrap``, ``interp``
* ``savgol_smoothing_cval``: optional


Implementation
~~~~~~~~~~~~~~~

Data smoothing is applied in the backend after the raw IDS data has been converted to a NumPy array and after the internal 2D data transformation step, when applicable.

The current implementation uses SciPy-based smoothing routines:

* Gaussian smoothing is applied with a Gaussian filter implementation.
* Savitzky-Golay smoothing is applied with a Savitzky-Golay filter implementation.

Because smoothing modifies the returned numerical values, it should be treated as a visualization-oriented transformation and not as a lossless representation of the original dataset.

Example usage
~~~~~~~~~~~~~~

The following examples demonstrate how smoothing can be enabled for testing purposes.

Gaussian smoothing:

.. code-block:: bash

   curl -X 'GET' \
     '<IBEX_server_address>/data/plot_data?uri=<IMAS_URI>&smoothing_method=gaussian_filter&gaussian_smoothing_sigma=1.0' \
     -H 'accept: application/json'

Savitzky-Golay smoothing:

.. code-block:: bash

   curl -X 'GET' \
     '<IBEX_server_address>/data/plot_data?uri=<IMAS_URI>&smoothing_method=savitzky_golay_filter&savgol_smoothing_window_length=5&savgol_smoothing_polyorder=2' \
     -H 'accept: application/json'


Simple data operations
------------------------

IBEX supports a sequence of scalar operations that can be applied element-wise to every data point in the returned dataset.
Simple data operations use fixed numeric values.

The following operation types are supported:

* ``add`` — addition
* ``sub`` — subtraction
* ``mul`` — multiplication
* ``div`` — division
* ``pow`` — exponentiation
* ``root`` — Nth root

Operations are applied **in the order they appear** in the request.
In the processing pipeline they run **after** smoothing and interpolation, but **before** downsampling.

Configuration
~~~~~~~~~~~~~~

Simple data operations are configured through the ``operations`` parameter of the ``/data/plot_data/`` endpoint.
It accepts a list of strings in the format ``type:value``, for example ``add:10`` or ``mul:2.5``.

The full list of available operations can be retrieved from the ``/info/data_manipulation_methods/`` endpoint.

Division by zero is rejected by the backend with an ``InvalidParametersException`` ("Division by zero is not allowed").

Implementation
~~~~~~~~~~~~~~~

Simple data operations are applied in ``apply_simple_operations()`` in
``backend/ibex/data_source/imas_python_source_utils.py``.

The function iterates over the list of operation strings in order, splitting each on the colon to extract the operation type and the scalar value.
For each operation the corresponding arithmetic lambda is applied element-wise to the data array.

The implementation handles both flat arrays and nested lists of arrays (higher-dimensional data) recursively.

Example usage
~~~~~~~~~~~~~~

The following examples demonstrate how simple data operations can be enabled for testing purposes.

Single operation (addition by 2):

.. code-block:: bash

   curl -X 'GET' \
     '<IBEX_server_address>/data/plot_data?uri=<IMAS_URI>&operations=add:2' \
     -H 'accept: application/json'

Two chained operations (add then multiply):

.. code-block:: bash

   curl -X 'GET' \
     '<IBEX_server_address>/data/plot_data?uri=<IMAS_URI>&operations=add:2&operations=mul:3' \
     -H 'accept: application/json'

Order matters (multiply then add yields different result):

.. code-block:: bash

   curl -X 'GET' \
     '<IBEX_server_address>/data/plot_data?uri=<IMAS_URI>&operations=mul:3&operations=add:2' \
     -H 'accept: application/json'

Signal operations
------------------

IBEX supports element-wise arithmetic between two signals (datasets) during a ``/data/plot_data`` request.
Unlike simple scalar operations which use fixed numeric values, signal operations use **other IMAS signals** as operands.
This enables combining data from different IMAS nodes arithmetically, for example subtracting a background signal from a measurement.

Signal operations are applied **after data interpolation** and **before downsampling**.
When a signal referenced in a signal operation was not already interpolated via the ``interpolate_over`` parameter, it is interpolated on the fly onto the common coordinate grid during this step.
Operations are applied in the order they appear in the request.

Configuration
~~~~~~~~~~~~~~

Signal operations are configured through the ``operations`` parameter of the ``/data/plot_data/`` endpoint (the same parameter as for simple scalar operations).
It accepts a list of strings in the format ``type:uri``, where ``type`` is one of the supported operations and ``uri`` is the IMAS URI of the operand signal.

The following operation types are supported:

* ``add`` — addition
* ``sub`` — subtraction
* ``mul`` — multiplication
* ``div`` — division

Division by zero is rejected by the backend.

The full list of available operations can be retrieved from the ``/info/data_manipulation_methods/`` endpoint.

Implementation
~~~~~~~~~~~~~~~

Signal operations are applied in ``apply_signal_operations()`` in
``backend/ibex/data_source/imas_python_source_utils.py``.

The function iterates over the list of operation strings in order, looking up each
operand signal's interpolated data from a dictionary populated during the interpolation step. For each operation the corresponding arithmetic function is applied element-wise between the current result and the operand signal data.

The implementation handles both flat arrays and nested lists of arrays (higher-dimensional data) recursively.

Example usage
~~~~~~~~~~~~~~

The following examples demonstrate how signal operations can be enabled for testing purposes.

Addition of two signals:

.. code-block:: bash

   curl -X 'GET' \
     '<IBEX_server_address>/data/plot_data?uri=<IMAS_URI>&operations=add:<other_signal_URI>' \
     -H 'accept: application/json'

Multiple signal operations (subtraction then multiplication):

.. code-block:: bash

   curl -X 'GET' \
     '<IBEX_server_address>/data/plot_data?uri=<IMAS_URI>&operations=sub:<other_signal_URI>&operations=mul:<yet_another_URI>' \
     -H 'accept: application/json'




