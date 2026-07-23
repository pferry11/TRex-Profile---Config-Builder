# Usability walkthrough — cap2 (STF)

**Produces:** a legacy pcap-replay profile (`.yaml`)
**Budget:** ~20 min · **Method:** [README.md](README.md)

---

## 1. Cap2 is the tab most at risk of being used by mistake

cap2 is the **legacy** STF path; ASTF supersedes it for most work. The single
most valuable thing this walkthrough can establish is whether a tester who
should be using ASTF ends up here — and whether the tab tells them.

## 2. Cold-start task

> We have a captured DNS conversation in a pcap. Set up a test that replays it
> at 100 connections per second, and rewrites four bytes of the payload on the
> first packet so each flow looks slightly different.

**Done when:** the output pane shows a cap2 YAML with a `cap_info` entry
pointing at the pcap, `cps: 100`, and a `dyn_pyload` block.

---

## 3. Observation log

| Time | What the tester did / said | Hesitation? |
|---|---|---|
| | | |

Time to first correct output: ______

---

## 4. Checkpoints

Common **U1–U10** — see [README.md](README.md). Plus:

| # | Checkpoint |
|---|---|
| C1 | Is it clear this is the **legacy** path, and when you'd prefer ASTF instead? Ask the tester directly afterwards: "when would you use this tab rather than ASTF?" |
| C2 | Is `dyn_pyload` explicable from the UI alone — offset, type, length — without opening TRex docs? |
| C3 | Is it clear that cap2 profiles run via `t-rex-64 -f`, **not** the interactive console like STL/ASTF? |
| C4 | Are the generator fields (client/server ranges, clients-per-Gb, dual-port mask) meaningful, or just accepted as given? |
| C5 | Does the pcap **Browse…** button appear when the backend is up, and is its absence on `file://` confusing? |
| C6 | Is the relationship between `cps`, `ipg` and `rtt` clear enough to set them confidently? |

---

## 5. Edit task

cap2 has the most mature re-import path (67/67 shipped profiles map at 100%), so
test it harder than the other tabs:

> Here is a cap2 YAML — not one this tool made, it came from the TRex examples.
> Load it up and change the connection rate.

**Watch for:**
- Does the tester understand the **coverage report** shown after importing a
  foreign file? Does "83% mapped" mean anything actionable to them, or is it
  alarming noise?
- Do they trust the result enough to use it?

---

## 6. Results

```
Date:
Tester:
Author of this tab?   yes / no
Cold-start time:
Findings logged:      F___ .. F___
```
