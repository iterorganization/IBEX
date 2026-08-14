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

📖 [Frontend readme](frontend/README.md) · 📖 [Backend readme](backend/README.md)

## 🚧 Project Status

IBEX is under **active development**. Core exploration, plotting, and data
manipulation workflows are functional, but important changes — including to
the backend endpoint API — may still occur between releases. Expect fast
iteration, and please report issues or gaps you encounter via
[GitHub Issues](https://github.com/iterorganization/IBEX/issues).

## Quick Start

### Prerequisites
- Python 3.9+
- Node.js 16+

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

## 🗺️ TODO / Roadmap 

- Improve performance and reactivity
- UX friendliness
- Plots parametrization
- Use as a webapp (linked to [SimDB-Dashboard](https://github.com/iterorganization/SimDB-Dashboard))


Want to help? See [CONTRIBUTING.md](CONTRIBUTING.md) to get started.
