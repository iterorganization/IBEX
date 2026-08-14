End-to-End (E2E) Tests
-----------------------------------

**Purpose:**

* E2E tests simulate real user interactions in the application and ensure that the interface behaves as expected.

* Validating user workflows.

* Ensure there is no regressions.


**Tools used:**

* **Selenium WebDriver** — automates Electron UI testing.

**Test coverage includes:**

* Navigation through the application.
* Browsing and selecting datasets from HDF5 files.
* Generating plots based on selected data.
* Manipulating plotted data: smoothing (gaussian and Savitzky-Golay filters) and
  data operations (constant and signal), including the unit produced by an
  operation being reported on a second Y axis.
* Verifying UI components render correctly with Mantine styles.

**Prerequisites to run:**

To run E2E tests in local mode, datasets are required. These are listed in the zenodo_datasets.txt file and must be placed in a folder named e2e_datasets at the root of the project.

**How to run it locally:**

Start the application in test mode 

.. code-block:: bash

    source ibex_venv/bin/activate
    cd frontend

    # Start the application in test mode
    npm run start:e2e

Run E2E tests

.. code-block:: bash

    source ibex_venv/bin/activate
    cd frontend

    # Run E2E tests
    npm run test:e2e

**Best practices:**

* Write tests for new features before merging.
* Keep tests small and focused on a single workflow.
* Use descriptive names for test cases to clarify the scenario being tested.

