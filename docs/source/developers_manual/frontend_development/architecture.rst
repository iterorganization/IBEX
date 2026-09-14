=====================
Architecture
=====================

Overview
----------------

Ibex is a desktop application built with Electron, following a multi-process architecture that clearly separates system-level responsibilities from the user interface layer.

The project is organized into three main parts:

* **Configuration layer** (config/) — contains application and build configuration (environment settings, bundler configuration, packaging setup).
* **Main process** (main/) — handles Electron lifecycle management, window creation, and secure communication with the operating system.
* **Renderer process** (renderer/) — contains the React application, including UI components, state management, routing, and visualization logic.

This separation ensures:

* Clear isolation between system-level operations and UI logic
* Improved maintainability and scalability
* Safer communication between processes via preload and IPC
* Better testability of frontend logic

The majority of the business logic and application workflows are implemented in the Renderer process, while the Main process remains focused on system integration and application lifecycle management.

Directory Structure
-------------------------

Each directory has a specific responsibility:

.. code-block:: bash
  
  frontend/
   ├── src/
        ├── config/     # Application and build configuration
        ├── main/       # Electron main process
        ├── renderer/
             ├── assets/      # Static resources
             ├── components/  # Reusable UI components
             ├── layout/      # Defines structural UI elements
             ├── pages/       # Top-level views mapped to routes
             ├── router/      # Defines application routing
             ├── stores/      # Global state management layer
             ├── types/       # Contains shared TypeScript types and interfaces
             ├── utils/       # Framework-independent helper functions
             ├── App.tsx
             ├── index.tsx
             ├── index.html
             └── index.css
        ├── tests/      # Automated tests
