Code Style Tests
-----------------------------------

**Purpose:**

* Ensuring consistent code style helps maintain readability and reduces bugs.

**Tools used:**

* **ESLint** — lints the code for potential errors and code quality issues.
* **Prettier** — formats code according to project conventions.

**How to run it locally:**

.. code-block:: bash

    # Lint the project
    npm run lint

    # Format the code
    npm run format

**Best practices:**

* Always run lint and format before committing code.
* ESLint errors must be resolved before merging a pull request.
