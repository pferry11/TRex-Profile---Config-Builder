"""Topology: single TRex box, port 0 <-> port 1 cabled back to back.

The default and the strictest: traffic sent is traffic received, so rx can be
asserted tightly and latency is a real number rather than a DUT's behaviour.
Run:  robot --variablefile tests/robot/variables/env_loop.py --include loop ...
"""
from env_common import *  # noqa: F401,F403

TOPOLOGY = "loop"
TREX_PORTS = [0, 1]
TX_PORT = 0
RX_PORT = 1

# Looped fibre: near-lossless, so hold rx to the common floor and keep the
# latency ceiling meaningful.
RX_FLOOR_RATIO = 0.98
LATENCY_MAX_USEC = 1000
