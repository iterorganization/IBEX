.. _`Data interpolation`:

======================
Data interpolation
======================

Introduction
-------------

IBEX supports interpolation of datasets defined on differing coordinate grids. This functionality enables the combined visualization of data originating from multiple pulse files, even when their underlying coordinate systems are not aligned.

Preconditions
--------------

Interpolation is only supported when the following condition is satisfied:

The IDS name and node path must be identical for all URIs participating in the interpolation process
(``e.g. #equilibrium/time_slice[:]/profiles_2d[:]/psi``)

.. note::

   There is one exception to this rule:

   If the data node URI refers to an error bar node (i.e., a node with the _error_upper or _error_lower suffix),
   the interpolate_over URI may instead point directly to the corresponding data node rather than another error bar node.

   This behavior is particularly useful in cases where the error node provided via the ``interpolate_over`` parameter is empty.

   e.g. ``uri=<IMAS_URI1>#equilibrium/time_slice[:]/profiles_2d[:]/psi_error_upper`` and ``interpolate_over=uri=<IMAS_URI2>#equilibrium/time_slice[:]/profiles_2d[:]/psi``

Failure to meet this requirement will prevent interpolation from being performed.

Configuration
--------------

IBEX supports configurable interpolation behavior via the ``interpolation_method`` parameter of the ``/data/plot_data`` endpoint.

By default, the ``exact_value`` method is used. In this mode, the interpolated dataset retains values only at the original data points, while the coordinate grid may be extended.
No new values are computed between existing points.

Other supported interpolation methods include ``linear``, ``nearest``, ``slinear``, ``cubic``, ``quintic``, and ``pchip``.
These methods generate interpolated values across the full coordinate grid and follow the behavior described in the SciPy documentation for ``RegularGridInterpolator``.

You can retrieve the full list of available interpolation methods by querying the ``/info/data_manipulation_methods`` endpoint.



Implementation
---------------

The interpolation mechanism in IBEX is based on the ``RegularGridInterpolator`` class provided by the ``scipy.interpolate`` package.
Prior to interpolation, all coordinate arrays associated with the input datasets are merged into a single unified coordinate grid. This step is necessary to ensure compatibility across datasets but may significantly increase the size of the resulting data structure.

The merging of coordinate grids can lead to substantial growth in dataset size, particularly when coordinate ranges do not overlap.

For example:

If two datasets each contain a time vector with 100 elements and their ranges are disjoint, the resulting merged time vector will contain 200 elements.
Consequently, the interpolated dataset will be approximately twice the size of each individual input dataset.

This effect scales with the number of input URIs and the degree of non-overlap between their coordinate grids, potentially resulting in large response sizes and increased memory usage.

Example usage
---------------

Data interpolation is available via the /data/plot_data endpoint through the interpolate_over parameter.
To enable interpolation, at least one valid URI must be provided as the value of this parameter.
If the parameter is omitted or no valid URIs are supplied, interpolation will not be performed.

The following example demonstrates how to invoke the endpoint for testing purposes:

.. code-block:: bash

   curl -X 'GET' \
  '<IBEX_server_address>/data/plot_data?uri=<IMAS_URI>&interpolate_over=<IMAS_URI2>&interpolate_over=<IMAS_URI3>' \
  -H 'accept: application/json'



