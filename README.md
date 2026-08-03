# IBEX

IBEX (IMAS variaBles EXplorer) is a general purpose graphical tool for exploring the content of IMAS structured data. It can display quantities as 1D or 2D plots (possibly slicing through higher dimensionality datasets). It is expected to replace [IMASViz](https://github.com/IRFM/IMASViz) (which is not maintained anymore) and go beyond.

> [!NOTE]
> This project is under active development, important changes may occur including in the backend endpoint API. 

**Documentation:** https://imas-ibex.readthedocs.io/

[Frontend readme](frontend/README.md)

[Backend readme](backend/README.md)

## Quick Start

### Prerequisites
- Python 3.10+ (3.13 via the `IMAS-Python/2.3.0-intel-2025b` module on ITER systems)
- Node.js 16+ (22.17.1 via the `nodejs/22.17.1-GCCcore-14.3.0` module on ITER systems)

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
    ./launch-dev.sh
```
