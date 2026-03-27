================
Useful commands
================

Start the application
----------------------------

**Development mode**

Starts the Electron application in development mode with hot-reloading:

.. code-block:: bash

  ./launch-dev.sh

**Production mode**

Starts the Electron application in production mode:

.. code-block:: bash

  ./install.sh
  ./launch.sh


Install packages
--------------------

Install the dependencies using npm:

.. code-block:: bash

  npm install

Format & lint the code
------------------------------

**Format**

Formats the codebase before committing using Prettier:

.. code-block:: bash

  npm run format

**Lint**

Checks the code for style and syntax issues before committing using ESLint:

.. code-block:: bash

  npm run lint

Build the documentation
-------------------------------

**Install sphinx dependencies**

Install sphinx dependencies to be able to build the documentation:

.. code-block:: bash

  . ibex_venv/bin/activate
  pip install -U sphinx sphinx-autosummary-accessors sphinx_immaterial

**Build the documentation**

After having installed required dependencies, you can build the documentation:

.. code-block:: bash

  . ibex_venv/bin/activate
  make -C docs html
