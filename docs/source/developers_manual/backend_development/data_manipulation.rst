.. _`Data manipulation`:

======================
Data manipulation
======================

Introduction
-------------

The IBEX backend provides a range of data manipulation techniques that directly affect the shape and appearance of the resulting plots.

Smoothing/Denoising
--------------------

IBEX leverages a Gaussian filtering mechanism to smooth irregular data series while reducing the impact of noise.
This approach enhances signal clarity without significantly distorting underlying trends.

.. note::
   The algorithm is implemented using the Gaussian filter available in ``scipy.ndimage`` package:
   https://docs.scipy.org/doc/scipy/reference/generated/scipy.ndimage.gaussian_filter.html

This feature extends the ``data.plot_data`` endpoint with two additional parameters:

apply_smoothing: Boolean - enables or disables the application of Gaussian smoothing.
smoothing_sigma: Float - specifies the standard deviation of the Gaussian kernel; defaults to 1.