import os
from pathlib import Path

uris_label = ["pulsefile uri"]

if os.environ.get("GITHUB_ACTIONS") == "true":
    # On GitHub Actions: use publicly available Zenodo datasets (CC-BY 4.0)
    # https://zenodo.org/records/17062700
    # Downloaded by the workflow into IBEX_TEST_DATA_DIR before benchmarks run.
    _data_dir = Path(os.environ["IBEX_TEST_DATA_DIR"])
    uris = [
        str(_data_dir / "iter_scenario_53298_seq1_DD4.nc"),  # ~14 MB, single time slice (DD 4.0.0)
        str(_data_dir / "iter_scenario_123364_1.nc"),        # ~118 MB, single time slice (DD 4.0.0)
    ]
else:
    # Local / ITER infrastructure: use internal IMAS data sources directly
    uris = [
        "imas:mdsplus?user=public;database=ITER;pulse=134173;run=106;version=3",  # 871 slices
        "imas:hdf5?user=public;database=ITER;pulse=134173;run=106;version=3",     # 871 slices
        "imas:hdf5?path=/work/imas/shared/imasdb/ITER/3/105070/2",               # 4183 slices
    ]
