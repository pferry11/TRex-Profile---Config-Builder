# Usability walkthrough — Platform Config

**Produces:** `trex_cfg.yaml`
**Budget:** ~20 min · **Method:** [README.md](README.md)

---

## 1. Cold-start task

Hand the tester **real `lspci` output** from an actual box (or a realistic
paste), plus this:

> Here's the hardware in our new TRex box. Produce the config file TRex needs to
> start on it: two 10 Gb ports, 8 cores available, and the two ports should send
> to each other.

**Done when:** the output shows a `trex_cfg.yaml` with the right PCI addresses,
port count and core assignment.

**Watch for specifically:** this is the tab with the hardest *input mapping*
problem — the tester has to get from `lspci` output to the fields. That
translation step is the whole test.

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
| P1 | Can the tester map real `lspci` output onto the interface fields **without help**? Where exactly did they stall? |
| P2 | Is the PCI address format expected by the field obvious (`03:00.0`), and does a wrong format produce a helpful message? |
| P3 | Is the IP-mode vs MAC-mode choice clear, and is it clear you pick one per port pair rather than mixing? |
| P4 | Is the core/thread assignment section approachable, or does the tester skip it and hope? |
| P5 | Does the tester understand the master/latency thread ids are *excluded* from the worker threads? |
| P6 | Do the warnings about thread collisions and core excess explain the fix, not just the fault? |
| P7 | Is the relationship between this tab and the **Settings → server registry** clear? Does the tester understand where the server list comes from? |
| P8 | Is it clear where on the box the file must be placed (`/etc/trex_cfg.yaml`)? |

---

## 4. Edit task

> We're adding two more ports to that box. Update the config.

**Watch for:** whether the tester keeps `port_limit` consistent with the
interface count. (T1 asserts this automatically — a mismatch stops TRex from
starting — so if a *human* can produce an inconsistent config through the UI
without a warning, that is an S2 finding at minimum.)

---

## 5. Results

```
Date:
Tester:
Author of this tab?   yes / no
Cold-start time:
Findings logged:      F___ .. F___
```
