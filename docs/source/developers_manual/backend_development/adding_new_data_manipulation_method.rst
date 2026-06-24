.. _`Adding new data manipulation method`:


Adding a new data manipulation method
--------------------------------------

Adding a new data manipulation operation requires updates in three places: the request model, the operation description registry, and the backend execution path.

Request model
~~~~~~~~~~~~~~

Expose the new operation through the request schema in ``backend/ibex/endpoints/schemas/request_data_schemas.py``.

In practice this usually means:

* adding a new top-level selector field to ``PlotDataBasicParameters`` if the operation introduces a new method family
* adding a dedicated parameter model when the operation needs extra configuration fields
* extending ``PlotDataRequestModel`` so the new parameters are accepted by ``/data/plot_data/``
* adding validation in a ``model_validator`` when some parameters are required only for specific operation modes

This is the layer that defines which query parameters are accepted and how they are validated before the request reaches the data source.

Operation description registry
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Register the operation in ``backend/ibex/core/data_manipulation_methods.py``.

This file provides the metadata returned by ``/info/data_manipulation_methods/``, so every new operation should be described there using:

* ``DataManipulationOperation`` for the operation itself
* ``DataManipulationParameter`` for top-level request parameters
* ``PossibleValue`` for supported modes or variants
* ``AdditionalParameter`` for parameters that are only relevant to a specific mode

This description should match the request schema exactly.
If a parameter is accepted by ``PlotDataRequestModel``, it should also be reflected here so that the API can describe it consistently.

Backend execution
~~~~~~~~~~~~~~~~~~

Implement the actual operation in ``backend/ibex/data_source/imas_python_source.py``.

This is where the backend transforms the numerical data returned from the IDS source.

When adding a new operation:

* read the parameters from ``plot_data_query``
* apply the transformation to ``data_to_be_returned``

If the logic becomes substantial or reusable, the numerical transformation itself should be extracted into a helper function and then called from the data source flow.

