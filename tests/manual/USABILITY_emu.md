# Usability walkthrough — EMU

**Produces:** a TRex-EMU client-emulation profile (`.py`) + `EMU_CONSOLE.txt` runbook
**Budget:** ~20 min · **Method:** [README.md](README.md)

---

## 1. Cold-start task

> We need to simulate 200 client devices on the network: each one should get its
> IP address by DHCP, answer pings, and join a multicast group. Produce whatever
> we need to run that.

**Done when:** the output shows an EMU profile with 200 clients, DHCPv4 enabled,
ICMP enabled, IGMP enabled — and the tester has noticed the runbook file.

**Watch for specifically:** EMU is a **separate process** (`./trex-emu`), not
something the normal TRex launch covers. Does the tester realise that, and when?
If they only discover it by reading the generated runbook after the fact, that is
a finding.

---

## 2. Observation log

| Time | What the tester did / said | Hesitation? |
|---|---|---|
| | | |

Time to first correct output: ______

---

## 3. Checkpoints

Common **U1–U10** — see [README.md](README.md). Plus:

| # | Checkpoint |
|---|---|
| E1 | Is it clear EMU runs as its **own daemon** with its own launch, separate from `t-rex-64`? |
| E2 | Did the tester notice that **two** files were produced (profile + runbook)? |
| E3 | Is the plugin list understandable as "capabilities each emulated client has"? |
| E4 | When DHCP is enabled, is it clear the static IPv4 fields should be left off — and does the warning explain *why*, not just *that*? |
| E5 | Is the client MAC/IP stepping behaviour clear (that one base address expands to N clients)? |
| E6 | Is the DNS plugin's client-vs-server mode distinction obvious? |
| E7 | Would the tester know what to do next if the runbook were the only thing they had? |

---

## 4. Edit task

> Change it to 500 clients and turn on IPv6 neighbour discovery.

**Watch for:** EMU has **no re-import path** — there is no *Open profile…* for
`.py` EMU files, only *Open builder file…* for the `.trexb.json`. Does the tester
expect to be able to re-open the generated `.py`? Log their reaction; this is a
real asymmetry with STL/ASTF and worth knowing whether it surprises people.

---

## 5. Results

```
Date:
Tester:
Author of this tab?   yes / no
Cold-start time:
Findings logged:      F___ .. F___
```
