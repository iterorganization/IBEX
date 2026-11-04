<div align="center">
  <img src="docs/assets/ibex-logo.jpg" alt="IBEX logo" width="320">

  # IBEX — IMAS variaBles EXplorer

  [![Backend pytest](https://github.com/iterorganization/IBEX/actions/workflows/backend-pytest.yml/badge.svg)](https://github.com/iterorganization/IBEX/actions/workflows/backend-pytest.yml)
  [![Frontend build & packaging](https://github.com/iterorganization/IBEX/actions/workflows/frontend-build-and-packaging.yml/badge.svg)](https://github.com/iterorganization/IBEX/actions/workflows/frontend-build-and-packaging.yml)
  [![License: LGPL v3](https://img.shields.io/badge/License-LGPL%20v3-blue.svg)](LICENSE.txt)
</div>

IBEX is a general purpose graphical tool for exploring the content of **IMAS**
structured data (IDS). It displays quantities as 1D or 2D plots — including
slicing through higher-dimensionality datasets — and lets you interactively
inspect, compare, and manipulate signals from one or more data entries. IBEX
is expected to replace [IMASViz](https://github.com/IRFM/IMASViz) (which is no
longer maintained) and go beyond it.

**Documentation:** https://imas-ibex.readthedocs.io/

[Frontend readme](frontend/README.md) · [Backend readme](backend/README.md)


## Quick Start

### Prerequisites
- Python 3.9+
- Node.js >= 22.12

### Installation & Build

```bash
git clone <ibex_repo>
cd ibex/backend
python -m venv ibex_venv
source ibex_venv/bin/activate
pip install .

cd ../frontend
npm install
npm run package
```

### Run IBEX

```bash
./out/ibex-linux-x64/ibex
```

### Command-line options

`ibex`, `launch.sh` and `launch-dev.sh` all take the same options:

```text
ibex [-h] [-v] [-c FILE [FILE ...] | -u URI [URI ...] [-n NAME] [-t TEMPLATE]]

  -h, --help                show this help and exit
  -v, --version             print the IBEX version and exit
  -c, --config FILE...      load one or more IbexState files, one configuration each
  -u, --uri URI...          open a new configuration containing these data entries
  -n, --name NAME           with --uri: name of the new configuration
                            (default: config, config-1, config-2, ...)
  -t, --template TEMPLATE   with --uri and --name: apply a template, given as a file
                            path or as a name from the template folders; the URIs
                            fill the template's URI-0, URI-1, ... in order
```

`--config` and `--uri` cannot be used together, since a state file already lists its
data entries. When either is given, the default configuration set in the preferences
is not loaded. `--help` also lists the templates installed with IBEX, which
`--template` takes by name. 

```bash
./launch.sh -c runIbexState.json otherIbexState.json
./launch.sh -u "imas:hdf5?path=/path/to/entry1" "imas:hdf5?path=/path/to/entry2"
./launch.sh -u "imas:hdf5?path=/path/to/entry" -n kinetic -t PlotKineticProfiles
```

The backend prints only warnings and errors to the console. To debug it, set
`IBEX_LOG_LEVEL=info` to add the HTTP access log, or `IBEX_LOG_LEVEL=debug` to also log
how long each endpoint takes:

```bash
IBEX_LOG_LEVEL=debug ./launch.sh
```

## Developer Installation

### installation on SDCC

```commandline
    git clone <ibex_repo>
    cd ibex
    
    # this script packs frontend and prepares site-packages with backend
    ./install.sh

    # test if it runs successfully
    ./frontend/out/ibex-linux-x64/ibex
```

### Run IBEX on SDCC

```commandline
    # first you have to install ibex as shown in step "Central installation on SDCC"
    ./<ibex_repo>/launch.sh
```

### Development run

```commandline
    git clone <ibex_repo>
    cd ibex
    
    # this script creates venv, installs python package in editable mode and runs fronend
	module load IMAS-Python IDStools nodejs
    ./launch-dev.sh
```

## 🚧 Project Status

IBEX is under **active development**. Core exploration, plotting, and data
manipulation workflows are functional, but important changes — including to
the backend endpoint API — may still occur between releases. Expect fast
iteration, and please report issues or gaps you encounter via
[GitHub Issues](https://github.com/iterorganization/IBEX/issues).


## TODO / Roadmap 

- Improve performance and reactivity
- UX friendliness
- Plots parametrization
- Use as a webapp (linked to [SimDB-Dashboard](https://github.com/iterorganization/SimDB-Dashboard))


Want to help? See [CONTRIBUTING.md](CONTRIBUTING.md) to get started.
