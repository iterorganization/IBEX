.. _`How to launch ibex tools`:

===================
How to launch IBEX?
===================

IBEX is structured into two components: a **frontend** and a **backend**. Both must be running to use
all IBEX features. You build the application once, then launch it: the packaged application
automatically starts the backend and connects to it.

The backend reads IMAS data through `IMAS-Python <https://github.com/iterorganization/IMAS-Python>`_
and its low-level **IMAS Core** library (the ``imas_core`` package). Launching IBEX therefore
requires an environment that provides this IMAS stack, together with a recent Python and Node.js.

Prerequisites
-------------

* An **IMAS environment** providing both **IMAS-Python** (the ``imas`` package) and **IMAS Core**
  (the ``imas_core`` package), running on **Python 3.10 or newer**.

  * On **ITER systems** (e.g. the SDCC cluster), these are available as *environment modules* — this
    is the recommended and tested setup, used throughout this page.
  * On **other systems**, IMAS-Python is installable from PyPI (``pip install imas-python``), but
    **IMAS Core is not distributed on PyPI**: it must be built from the ITER sources. Refer to the
    `IMAS-Python installation guide <https://imas-python.readthedocs.io/en/stable/installing.html>`_
    for details. Without ``imas_core`` the backend cannot start.

* `Node.js <https://nodejs.org/>`_ 16 or newer with ``npm`` (the ``nodejs`` module on ITER systems).
* `git <https://git-scm.com/>`_.

Getting the source
------------------

Clone the repository and move into it:

.. code-block:: bash

   # Clone by SSH
   git clone git@github.com:iterorganization/IBEX.git

   # ...or by HTTPS
   git clone https://github.com/iterorganization/IBEX.git

   cd IBEX

Loading the IMAS environment
----------------------------

On an ITER system, load the IMAS-Python and Node.js modules. Loading ``IMAS-Python`` brings in a
recent Python (3.11), the ``imas`` and ``imas_core`` packages, and the NetCDF support needed to read
data files:

.. code-block:: bash

   # Run `module avail IMAS-Python` to list the versions available on your system
   module load IMAS-Python/2.3.0-foss-2023b nodejs

.. note::

   On non-ITER systems, activate instead your own IMAS environment (Python 3.10+ with ``imas`` and
   ``imas_core`` importable), then follow the same steps below.

Installing the backend
----------------------

Create the virtual environment **with** ``--system-site-packages`` so that it can see the ``imas``
and ``imas_core`` packages provided by the loaded module, then install the backend into it:

.. code-block:: bash

   cd backend
   python -m venv --system-site-packages venv
   . venv/bin/activate

   pip install --upgrade pip
   pip install .

.. caution::

   The ``--system-site-packages`` flag is essential: a plain ``python -m venv venv`` would hide the
   module-provided ``imas``/``imas_core`` packages, and the backend would fail to start with
   ``ModuleNotFoundError: No module named 'imas_core'``.

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

Launch the packaged application from a terminal where the IMAS module is loaded **and** the backend
virtual environment is activated, so that ``run_ibex_service`` (and ``imas_core``) are available:

.. code-block:: bash

   # From the repository root
   module load IMAS-Python/2.3.0-foss-2023b nodejs   # if not already loaded
   . backend/venv/bin/activate                        # if not already active
   ./frontend/out/ibex-linux-x64/ibex

.. note::

   The application automatically starts the backend on a free local port and connects to it, so no
   further configuration is required. The IMAS module must stay loaded and the virtual environment
   activated: this is what lets the app find and start ``run_ibex_service`` with ``imas_core``
   available. IBEX also needs a graphical display; GPU warnings printed on remote or headless
   sessions are harmless (the app falls back to software rendering).

Quick launch with the helper scripts (ITER systems)
---------------------------------------------------

On ITER systems, helper scripts wrap the whole install and launch process (module loading, virtual
environment, free ports and backend/frontend startup).

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

   For the **development run mode** (running from source with hot-reloading), see
   :doc:`/developers_manual/frontend_development/installation` in the developer's manual.
