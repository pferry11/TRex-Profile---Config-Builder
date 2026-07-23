"""Topology: two TRex boxes, one client-side and one server-side.

Required by the Scenarios tab's two-server send/receive, bidirectional and
N-stage ramp wizards, where the profile and runbook are generated as a matched
pair for two different hosts.
Run:  robot --variablefile tests/robot/variables/env_dual.py --include dual ...
"""
import os

from env_common import *  # noqa: F401,F403

TOPOLOGY = "dual"

# Box A (client role by default) reuses the common TREX_HOST/TREX_USER.
TREX_HOST_B = os.environ.get("TREX_HOST_B")
TREX_USER_B = os.environ.get("TREX_USER_B", "root")
TREX_SSH_KEY_B = os.environ.get("TREX_SSH_KEY_B") or os.environ.get("TREX_SSH_KEY")
TREX_DIR_B = os.environ.get("TREX_DIR_B", "/opt/trex/v3.06")

TREX_PORTS = [0, 1]
TX_PORT = 0
RX_PORT = 1

# Cross-box measurement: clocks are not synchronised, so latency assertions are
# per-box only and the shared ceiling stays loose.
RX_FLOOR_RATIO = 0.95
LATENCY_MAX_USEC = 20000
