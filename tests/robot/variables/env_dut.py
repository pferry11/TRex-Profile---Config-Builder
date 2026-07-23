"""Topology: single TRex box with a DUT in the traffic path.

Same test bodies as env_loop; only the thresholds move. A DUT may legitimately
drop, buffer or reorder, so rx becomes a floor rather than an equality and the
latency ceiling widens. If a test needs a *tighter* assertion than this file
allows, it belongs in the loop-only set - do not weaken shared thresholds.
Run:  robot --variablefile tests/robot/variables/env_dut.py --include dut ...
"""
from env_common import *  # noqa: F401,F403

TOPOLOGY = "dut"
TREX_PORTS = [0, 1]
TX_PORT = 0
RX_PORT = 1

# A DUT is allowed to lose some traffic; what it is not allowed to do is
# produce interface errors, which the suites assert separately.
RX_FLOOR_RATIO = 0.90
LATENCY_MAX_USEC = 20000
RATE_TOLERANCE_PCT = 10
