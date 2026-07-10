.. _`How to launch ibex tools`:

===================
How to launch IBEX?
===================

IBEX is structured into two components: a **frontend** and a **backend**. Both must be running to use
all IBEX features. On a standard Linux system you build the application once, then launch it: the
packaged application automatically starts the backend and connects to it.

Prerequisites
-------------

* A Linux x86-64 system
* `Python <https://www.python.org/>`_ 3.9 or newer
* `Node.js <https://nodejs.org/>`_ 16 or newer, with ``npm``
* `git <https://git-scm.com/>`_

Getting the source
------------------

Clone the repository and move into it:

.. code-block:: bash

   # Clone by SSH
   git clone git@github.com:iterorganization/IBEX.git

   # ...or by HTTPS
   git clone https://github.com/iterorganization/IBEX.git

   cd IBEX

Installing the backend
----------------------

The backend is a standard Python package. Install it in a dedicated virtual environment. IMAS-Python
provides the ``imas`` package and must be installed explicitly, as it is not pulled in automatically;
IDStools is installed as a dependency.

.. code-block:: bash

   cd backend
   python -m venv venv
   . venv/bin/activate

   pip install --upgrade pip
   pip install imas-python   # provides the `imas` package (not installed automatically)
   pip install .

.. note::

   Depending on the data formats you want to read, IMAS-Python may require additional optional
   dependencies. Refer to the `IMAS-Python project
   <https://github.com/iterorganization/IMAS-Python>`_ for detailed installation instructions.

Installing the frontend
-----------------------

From the repository root, build the Electron application:

.. code-block:: bash

   cd frontend
   npm install
   npm run package

This produces the executable in ``frontend/out/ibex-linux-x64/``.

Running IBEX
------------

Launch the packaged application from a terminal where the backend virtual environment is activated,
so that the ``run_ibex_service`` command is available on your ``PATH``:

.. code-block:: bash

   # From the repository root, with the backend venv activated
   . backend/venv/bin/activate   # if it is not already active
   ./frontend/out/ibex-linux-x64/ibex

.. note::

   The application automatically starts the backend on a free local port and connects to it, so no
   further configuration is required. Keep the virtual environment activated when launching the
   application: it is what allows the app to find and start ``run_ibex_service``.

On the ITER SDCC cluster
------------------------

On the ITER SDCC cluster, IMAS-Python, IDStools and Node.js are provided as environment modules, and
helper scripts wrap the whole installation and launch process.

The installation stage is performed once and generates an executable that can be shared by multiple
users (assuming proper permission settings are in place):

.. code-block:: bash

   cd IBEX
   git checkout main
   ./install.sh

The application can then be launched with:

.. code-block:: bash

   cd IBEX
   ./launch.sh

.. seealso::

   For the **development run mode** (running from source with hot-reloading, on SDCC or locally), see
   :doc:`/developers_manual/frontend_development/installation` in the developer's manual.
