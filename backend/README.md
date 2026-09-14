# Ibex backend

## Installation

## Requirements

Load required modules

```commandline
module load IDStools IMAS-Python
```

## Development setup

```commandline
python -m venv venv
. venv/bin/activate

# in `backend` directory
pip install -e . # editable mode allows changes to have instant impact
```

## Development run
```commandline
./bin/run_ibex_service

>...
>Uvicorn running on http://127.0.0.1:<port_number>
>...

# start firefox and open localhost:<port_number>/docs to explore endpoints

# you can also specify port number when running service
./bin/run_ibex_service -p 8000
```

## Documentation build
```commandline
. venv/bin/activate
pip install sphinx==8.2.3 sphinx-autosummary-accessors==2025.3.1 sphinx_immaterial==0.13.9

make -C docs html
```

## Testing
```commandline
python -m pytest tests/ #make sure to run pythest with python -m. Otherwise it won't see installed fastapi packages
```

## Benchmarking
```commandline
./ci/run_benchmarks.sh
# results will be saved in `cwd`/ibex_benchmarks
```
