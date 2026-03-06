================
Introduction
================

Ibex Frontend is a desktop application built with Electron that provides a modern interface for exploring and visualizing scientific data stored in **HDF5 (H5)** files produced by **IMAS / imaspy**.

The application allows users to browse hierarchical data structures, select datasets, and generate interactive plots. It is designed to simplify the creation and management of visualization configurations for scientific workflows.

Ibex focuses on providing a responsive and modular interface while remaining maintainable and testable for developers.

---------------
Key Features
---------------

* **Interactive data exploration** — Browse HDF5 file structures and easily select datasets for visualization.

* **Flexible plotting configuration** — Create and manage visualization configurations for scientific analysis.

------------------------------
Technology Stack
------------------------------

~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
UI and Application Framework
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

* **React** — component-based architecture for building interactive user interfaces.

* **Mantine** — UI component library with theming and styling utilities.

* **Electron** — desktop runtime environment for packaging the application.

~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
State Management
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

* **Zustand** — lightweight state management solution used to manage application state.

~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Development Tooling
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

* **TypeScript** — static typing for improved maintainability and developer experience.

* **Webpack** — module bundler used to build the application.

* **ESLint & Prettier** — code linting and formatting tools to enforce code quality and consistency.

~~~~~~~~~~~~~~~
Testing
~~~~~~~~~~~~~~~

* **Selenium** is used for **end-to-end (E2E) UI testing**, validating user workflows in the Electron application.