"""Pin the GenVM build this suite runs on.

`direct_deploy("contracts/CausalBond.py")` with no `sdk_version` lets gltest
resolve "latest" at run time. On a machine with a warm cache that silently picks
up whatever is already there; on a clean reviewer machine it downloads a build
this contract was never verified against, and a withdrawn release returns 404
instead of a test result. requirements.txt pins the Direct Mode test dependency,
but it does not pin the GenVM runtime fetched by direct_deploy, so this file
closes that gap.

v0.2.12 is the build this suite has been executed against and passes on. Change
it deliberately, not by accident: bump the value here, run the suite, and only
then record the new version. Override per-run with GENVM_VERSION=... .
"""
import os
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]

CONTRACT = str(
    pathlib.Path(
        os.environ.get("CAUSALBOND_CONTRACT")
        or ROOT / "contracts" / "CausalBond.py"
    )
)

GENVM_VERSION = os.environ.get("GENVM_VERSION", "v0.2.12")
