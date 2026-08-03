.. _`Backend development introduction`:

===================
Introduction
===================

Backend structure
---------------------------

The IBEX backend is structured into three distinct layers, each represented by a corresponding directory within the ibex Python package:

* endpoints – Defines all HTTP API endpoints. This layer is strictly limited to request handling and routing, and does not contain any business logic.
* core – Serves as an abstraction layer between the endpoints and data_sources layers. Its primary role is to decouple application logic from specific data source implementations, enabling interchangeability. May include minimal logic when necessary.
* data_sources – Implements the core application logic. This layer is responsible for all communication with data sources (IMAS-Python) and constructs the JSON responses returned to frontend.

Endpoints discovering and testing
-----------------------------------

One can explore the available endpoints of the IBEX server by visiting the `/docs` page of the application. This is an auto-generated Swagger UI that allows to:

* Browse available API endpoints
* Test requests and responses
* Validate and experiment with newly implemented features

Before accessing the documentation, server must be running (see :ref:`backend_development_run`).
Then, the following URL has to be put in a web browser address bar:

.. code-block:: bash

    <server_ip>:<server_port>/docs

E.g.:

.. code-block:: bash

    127.0.0.1:12345/docs

For requests that return relatively large responses, web browsers may become slow or unresponsive.
In such cases, it's recommended to use Python's `requests` package to test the API endpoints more efficiently:

.. code-block:: python

    import requests

    server_address = "http://127.0.0.1:12345"
    uri = "imas:mdsplus?path=<path_to_entry>"
    node_path = "#summary/time"

    route = f"{server_address}/data/plot_data"
    params = {"uri": f"{uri}{node_path}"}

    response = requests.get(route, params=params)

    # Ensure the request was successful
    assert response.status_code = 200

    # json_response is a dictionary containing the data returned by the endpoint
    json_response = response.json()

Backend requirements
---------------------------

The IBEX backend requires the IMAS-Python and IDStools packages to be installed.

On the SDCC machine, these packages are available through environment modules and can be easily loaded using the following command:

.. code-block:: bash

    module load IMAS-Python/2.3.0-intel-2025b IDStools/2.4.1-intel-2025b

.. caution::

   Always pin the module versions. An unversioned ``module load`` follows the cluster default,
   which moved from the 2023b to the 2025b toolchain on 2025-07-31 — taking Python from 3.11 to
   3.13 and breaking every virtual environment built before that date.

For local development, these packages must be installed manually by the developer.

Backend installation
---------------------------
Since the IBEX backend is a standard Python package, it can be installed using pip:

.. code-block:: bash

    cd backend
    # Create a virtual environment for isolated development
    python -m venv venv
    . venv/bin/activate

    # Install the package in editable mode to apply code changes without reinstalling
    pip install -e .

This setup allows for a clean development environment and ensures that any changes to the code are immediately reflected without the need for reinstallation.


.. _backend_development_run:

Backend development run
---------------------------

The IBEX server can be started using the `run_ibex_service` script located in the `bin` directory. To run the server on a specific port (e.g., 12345), use the following commands:

.. code-block:: bash

    cd backend

    # Start the IBEX server on port 12345
    ./run_ibex_service -p 12345



