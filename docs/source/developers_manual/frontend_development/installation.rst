================
Getting started
================


Prerequisites
------------------

* Node.js >= 16
* npm

You can load the module on ITER cluster by running the following command:

.. code-block:: bash

  module load nodejs/22.17.1-GCCcore-14.3.0

Pin the version: an unversioned ``module load nodejs`` follows the cluster default, which moved
from Node 20 to Node 22 with the 2025b toolchain on 2025-07-31.


Clone
------

Clone this repository and install the dependencies:

.. code-block:: bash

  # Clone by ssh
  git clone git@github.com:iterorganization/IBEX.git

.. code-block:: bash

  # Or by https
  git clone https://github.com/iterorganization/IBEX.git

Launch in developer mode
------------------------------------

Get into the root folder and launch it by using this command.

.. code-block:: bash

  ./launch-dev.sh

For more informations about the different ways to launch IBEX frontend, refers to :doc:`How to launch ibex? </users_manual/how_to_launch>`

