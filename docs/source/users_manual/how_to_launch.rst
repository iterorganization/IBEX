.. _`How to launch ibex tools`:

===================
How to launch ibex?
===================

IBEX is structured into two components: a frontend and a backend.
To fully utilize all IBEX features, both components must be properly configured and running.
To streamline this process, launch scripts have been introduced.

Development mode
-----------------------------------

The development run mode is used when modifying the IBEX source code to see changes immediately.
In this mode, the backend runs as a standard Python application, while the frontend is launched in a fast-run mode,
avoiding the lengthy process of building the Electron application executable.

However, there are a couple of downsides to development mode. First, it takes more time to launch compared to running a pre-built application executable.
Second, due to permission issues, only one user can run IBEX from a given source directory.
For regular, non-development use cases, the production mode is recommended.

* Open a terminal.
* Clone the repository (https://github.com/iterorganization/IBEX.git) 
* Run the following commands:

.. code-block:: bash

   cd ibex
   git checkout develop
   ./launch-dev.sh

Production mode
-----------------------------------

The production run mode is divided into two stages: installation and execution.
The installation stage is performed once and generates an executable that can be shared by multiple users—assuming proper permission settings are in place.
The execution stage configures and launches both the backend and frontend using built executables.

Since the installation process can take several minutes to complete, development mode is recommended when actively modifying the source code and pushing frequent changes.

* Open a terminal.
* Clone the repository (https://github.com/iterorganization/IBEX.git)
* Run the following commands:

.. code-block:: bash

   cd ibex
   git checkout main
   ./install.sh

.. code-block:: bash

   cd ibex
   ./launch.sh
