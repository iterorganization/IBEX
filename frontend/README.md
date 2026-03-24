# Ibex Frontend

Ibex frontend is an Electron application designed to deliver a rich and seamless user experience. Ibex is an application to create and manage configurations for visualizing **HDF5 (H5)** data files from IDS imaspy. It enables users to generate a file tree structure, select data, and plot graphs based on the selected data.

## Key Features

- **React** for building modular and responsive user interfaces.
- **Mantine** for powerful UI components and advanced theming.
- **Electron** for packaging and deploying a cross-platform desktop application.
- **Zustand** for simple and efficient state management.
- Modern development tools: ESLint, Prettier, TypeScript, and Webpack.

## Prerequisites

- Node.js >= 16
- npm

You can load the module on ITER cluster by running the following command:

```
module load nodejs
```

## Installation

Clone this repository and install the dependencies:

HTTPS : `git clone https://github.com/iterorganization/IBEX.git`

or

SSH : `git clone git@github.com:iterorganization/IBEX.git`

```
cd frontend
```

### Install Packages

Install the dependencies using npm:

```
npm install
```

### Environment Variables

To define the environment variables, create a `.env` file in the root directory of the project. You can define different PORT or API_URL using by application.
Refer to the `.env.example` file for the list of environment variables.

## Available Commands

Here are the commands you can use to manage the project:

### Development Commands

- Start the application

Starts the Electron application in development mode with hot-reloading:

```
npm run start
```

- Lint the code

Checks the code for style and syntax issues using ESLint:

```
npm run lint
```

- Format the code

Automatically formats the codebase using Prettier:

```
npm run format
```

### Build and Packaging Commands

- Build the application

Prepares the application for production by bundling the code:

```
npm run build
```

- Package the application

Packages the application into a distributable format (e.g., .exe, .deb, .dmg):

```
npm run package
```

- Generate platform-specific binaries

Creates platform-specific builds for your application:

```
npm run make
```

- Publish the application

Publishes the application to a distribution platform:

```
npm run publish
```

- Run app with debug mode

Run the application with debug mode, enable logs details to understand the application flow:

```
npm run debug
```

### Use linux executable

After run `npm run make`, you can find the executable file in the `out` directory. Copy/paste the ibex-linux-x64 directory to your desired location. You can run the application by executing the executable file:

```
cd out/ibex-linux-x64
./ibex
```

To custom the app config you can modify `resources/config.json`. This files contains the default configuration for the application.
