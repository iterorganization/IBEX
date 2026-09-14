Code Syntax / Build Tests
-----------------------------------

**Purpose:**

* Catch syntax errors or type issues before they reach production.
* Ensure that the code compiles correctly and the application can be packaged successfully.

**Tools used:**

* **TypeScript compiler (tsc)** — performs static type checking to ensure type safety and prevent compile-time errors.
* **Webpack** — bundles the React renderer process and Electron main process into optimized builds.
* **electron-forge** — orchestrates the Electron build and packaging process.

**How to run it locally:**

.. code-block:: bash

    # Package the Electron application
    npm run package
