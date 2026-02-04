# IBEX

IBEX (IMAS variaBles EXplorer) is a general purpose graphical tool for exploring the content of IMAS structured data. It can display quantities as 1D or 2D plots (possibly slicing through higher dimensionality datasets). It is expected to replace [IMASViz](https://github.com/IRFM/IMASViz) (which is not maintained anymore) and go beyond.

> [!NOTE]
> This project is under active development, important changes may occur including in the backend endpoint API. 


[Frontend readme](frontend/README.md)

[Backend readme](backend/README.md)

## Installation

### Central installation on SDCC

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
