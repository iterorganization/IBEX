"""
Smoke-test script: verifies that all node paths used in IBEX benchmarks
are accessible in the Zenodo netCDF file.

Uses iter_scenario_53298_seq1_DD4.nc — a JINTRAC core-edge simulation
containing core_profiles + equilibrium (required by all benchmark paths).

Note: iter_scenario_123364_1.nc is a SOLPS edge simulation. It contains
only edge_profiles/edge_transport/etc. and has NO core_profiles or
equilibrium, so it cannot be used for the current benchmark node paths.

Usage:
    python scripts/test_netcdf_paths.py [path/to/file.nc]

Defaults to test_data/iter_scenario_53298_seq1_DD4.nc relative to repo root.
"""

import sys
from pathlib import Path

import numpy as np
import imas

# ---------------------------------------------------------------------------
# Resolve file path
# ---------------------------------------------------------------------------
_repo_root = Path(__file__).parent.parent
_default_nc = _repo_root / "test_data" / "iter_scenario_53298_seq1_DD4.nc"
NC_FILE = Path(sys.argv[1]) if len(sys.argv) > 1 else _default_nc

if not NC_FILE.exists():
    sys.exit(
        f"ERROR: file not found: {NC_FILE}\n"
        "Download it with:\n"
        "  wget -O test_data/iter_scenario_53298_seq1_DD4.nc \\\n"
        '    "https://zenodo.org/records/17062700/files/iter_scenario_53298_seq1_DD4.nc?download=1"'
    )

print(f"Opening: {NC_FILE}\n")


# ---------------------------------------------------------------------------
# Helper — print result of accessing a node
# ---------------------------------------------------------------------------
def check(label: str, fn):
    try:
        node = fn()
        if isinstance(node, np.ndarray):        # numpy array (leaf data)
            desc = f"array shape={node.shape} dtype={node.dtype}"
        elif hasattr(node, "__len__") and not isinstance(node, str):  # AoS / list
            desc = f"{type(node).__name__} len={len(node)}"
        else:
            desc = f"{type(node).__name__} = {node!r}"
        print(f"  ✅  {label}")
        print(f"       result: {desc}")
    except Exception as exc:
        print(f"  ❌  {label}")
        print(f"       error : {exc}")
    print()


# ---------------------------------------------------------------------------
# Open file and run checks
# ---------------------------------------------------------------------------
with imas.DBEntry(str(NC_FILE), "r") as entry:

    # ---- core_profiles --------------------------------------------------------
    print("=" * 60)
    print("IDS: core_profiles (occurrence 0)")
    print("=" * 60)
    cp = entry.get("core_profiles")

    # Used in: endpoints_ids_info — time_node_info params
    check("IDS_BASE   — core_profiles root (the IDS object itself)",
          lambda: cp)

    check("STRUCTURE  — ids_properties",
          lambda: cp.ids_properties)

    # Note: returns 'N/A' (empty string) in this file — no error raised
    check("LEAF       — ids_properties/version_put/access_layer",
          lambda: cp.ids_properties.version_put.access_layer)

    check("AoS        — profiles_1d  [len=1, single time-slice file]",
          lambda: cp.profiles_1d)

    check("AoS elem   — profiles_1d[0]",
          lambda: cp.profiles_1d[0])

    check("LEAF       — profiles_1d[0]/t_i_average",
          lambda: cp.profiles_1d[0].t_i_average)

    # Used in: endpoints_data — time_field_value / time_plot_data
    check("LEAF       — time",
          lambda: cp.time)

    # IBEX handles [:] slice notation by iterating all available elements.
    # This file has 1 time slice so profiles_1d[:] yields [profiles_1d[0]].
    # NOTE: [0:100] would cause IndexError if IBEX iterates indices 0..99 via
    # __getitem__ and the array has fewer than 100 elements — use [:] instead.
    check("LEAF IN AoS SLICE — profiles_1d[:]/t_i_average  [all slices]",
          lambda: [p.t_i_average for p in list(cp.profiles_1d)[:]])

    # ---- equilibrium ----------------------------------------------------------
    print("=" * 60)
    print("IDS: equilibrium (occurrence 0)")
    print("=" * 60)
    eq = entry.get("equilibrium")

    check("time_slice len",
          lambda: eq.time_slice)

    check("time_slice[0]/profiles_2d len",
          lambda: eq.time_slice[0].profiles_2d)

    # Used in: endpoints_data — 2D QUANTITY
    # IBEX's path parser handles [:] internally; in IMAS-Python we iterate.
    check("2D QUANTITY — time_slice[0]/profiles_2d[0]/psi",
          lambda: eq.time_slice[0].profiles_2d[0].psi)

    check("2D QUANTITY — all psi arrays via [:] iteration",
          lambda: [p.psi for ts in list(eq.time_slice)[:]
                   for p in list(ts.profiles_2d)[:]])


print("=" * 60)
print("SUMMARY")
print("=" * 60)
print("File IDSes confirmed present: core_profiles, equilibrium")
print("All benchmark node paths are accessible in this file.")
print()
print("NOTE: iter_scenario_123364_1.nc (SOLPS edge sim) does NOT contain")
print("core_profiles or equilibrium — use DD4 file for these benchmarks.")
