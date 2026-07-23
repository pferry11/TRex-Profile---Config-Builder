"""Shared defaults for every topology.

Topology files (env_loop / env_dut / env_dual) import these and override only
what their lab actually changes. Robot loads exactly one topology file per run:

    robot --variablefile tests/robot/variables/env_loop.py ...

Nothing here is a test threshold that a test should hardcode - suites read
${RATE_TOLERANCE_PCT} and friends from these files so the same test body serves
all three labs (the abstraction the plan's Phase 4/5 verification checks).
"""
import os
from pathlib import Path

# --- repo geography -------------------------------------------------------
REPO_ROOT = str(Path(__file__).resolve().parents[3])
ROBOT_ROOT = str(Path(__file__).resolve().parents[1])
APP_INDEX = str(Path(REPO_ROOT) / "index.html")
TESTS_PAGE = str(Path(REPO_ROOT) / "tests.html")
WORKSPACE = str(Path(ROBOT_ROOT) / "workspace")     # scratch for generated artifacts
FIXTURES = str(Path(ROBOT_ROOT) / "fixtures")

# file:// URLs, percent-encoded. The repo path contains "&" ("TRex-Profile-&-
# Config-Builder"), which a hand-built file:/// string gets wrong - always use
# these rather than concatenating the paths above into a URL.
APP_INDEX_URL = Path(APP_INDEX).as_uri()
TESTS_PAGE_URL = Path(TESTS_PAGE).as_uri()

# --- T0 self-test floor ---------------------------------------------------
# tests.html registered this many tests when the harness was written. A floor,
# not an equality: adding tests is always fine, deleting them should fail.
EXPECTED_MIN_TESTS = 103

# --- import-coverage baselines (T2 gates) ---------------------------------
# Raise these when a release improves coverage; never lower them to make a run
# pass. Sourced from the README's documented figures and re-verified 2026-07-23.
CAP2_MIN_FULL = 67      # of 67 shipped cap2/avl profiles
STL_MIN_FULL = 22       # of 106 shipped stl/*.py (offline parser)
ASTF_MIN_FULL = 65      # of 98 shipped astf/*.py (offline parser)
STL_RESOLVER_MIN = 72   # of 106, tools/stl_resolve.py (execute-not-parse)
ASTF_RESOLVER_MIN = 85  # of 98, tools/astf_resolve.py

# --- browser --------------------------------------------------------------
BROWSER_HEADLESS = True
BROWSER_TYPE = "chromium"
# Widths exercised by the T4 layout checks and the T6a U9 checkpoint.
VIEWPORTS = [{"width": 1366, "height": 768},
             {"width": 1920, "height": 1080},
             {"width": 2560, "height": 1440}]

# --- lab (overridden per topology; None = tier is skipped) ----------------
TREX_HOST = os.environ.get("TREX_HOST")
TREX_USER = os.environ.get("TREX_USER", "root")
TREX_SSH_KEY = os.environ.get("TREX_SSH_KEY")
TREX_DIR = os.environ.get("TREX_DIR", "/opt/trex/v3.06")
TREX_SYNC_PORT = 4501
AGENT_REMOTE_DIR = "/tmp/trexb_harness"

# --- traffic pass criteria (functional + loose tolerance) -----------------
RATE_TOLERANCE_PCT = 10     # tx_pps must land within +/-10% of the requested rate
RX_FLOOR_RATIO = 0.98       # rx_pps >= this * tx_pps
LATENCY_MAX_USEC = 5000     # loose ceiling; a functional check, not a benchmark
TRAFFIC_DURATION_SEC = 5
SETTLE_SEC = 2              # ignore the first N seconds when sampling rates
