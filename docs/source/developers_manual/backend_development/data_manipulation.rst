.. _`Data manipulation`:

======================
Data manipulation
======================

Introduction
-------------

The IBEX backend provides a range of data manipulation techniques that directly affect the shape and appearance of the resulting plots.
These operations are applied as part of the ``/data/plot_data/`` request flow and allow the backend to transform datasets before they are returned to the frontend.
The backend applies the manipulation stages in this order:

1. simple data operations
2. data smoothing
3. data interpolation
4. downsampling

This means later stages operate on the output of earlier ones when the corresponding request parameters are enabled.

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


Simple scalar operations
------------------------

IBEX also supports a sequence of scalar operations that can be applied to the returned dataset:

* addition
* multiplication
* division
* exponentiation
* root

These operations are executed in that order. In practice, the backend applies them sequentially to the numerical data before any smoothing or resampling step.

The corresponding request parameters are:

* ``addition_addend``
* ``multiplication_factor``
* ``division_divisor``
* ``exponentiation_exponent``
* ``root_degree``

Division by zero is rejected by the backend.

Example usage
~~~~~~~~~~~~~~

The following examples demonstrate how simple data operations can be enabled for testing purposes.

Single operation:

.. code-block:: bash

   curl -X 'GET' \
     '<IBEX_server_address>/data/plot_data?uri=<IMAS_URI>&addition_addend=2' \
     -H 'accept: application/json'

Two operations:

.. code-block:: bash

   curl -X 'GET' \
     '<IBEX_server_address>/data/plot_data?uri=<IMAS_URI>&addition_addend=2&multiplication_factor=3' \
     -H 'accept: application/json'
