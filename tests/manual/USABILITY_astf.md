# Usability walkthrough — ASTF Profile

**Produces:** an advanced stateful profile (`.py`)
**Budget:** ~20 min · **Method:** [README.md](README.md)

---

## 1. Cold-start task

> We want to load-test a firewall with realistic HTTP sessions: about 500 new
> connections per second, where the client sends a request and the server
> replies with roughly 32 KB. Produce the profile file.

**Done when:** the output pane shows an ASTF profile with a program-mode
template (send/recv on both sides), a CPS value, and a server response body of
about 32 KB.

**Watch for specifically:**
- Do they pick **pcap replay** or a **send/recv program**? The task can be done
  either way — what matters is whether the tab made the choice *clear at the
  point of decision*, or whether they picked one and discovered later it was
  the wrong shape for the requirement.
- Do they understand that "cps" is connections per second and not something else?

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
| A1 | Is the **pcap-replay vs send/recv-program** choice clear at the moment it must be made, or only in hindsight? |
| A2 | Do the program command lists read as a *sequence* (send, then recv, then…)? Can the tester tell client and server sides apart at a glance? |
| A3 | **Known layout ambiguity:** does the stream/template editor have a heading distinct from the pcap-replay section? The collapsed pcap section has been observed to read as the editor's header — confirm whether the tester was misled. |
| A4 | Is the ip-generator (client/server ranges, distribution) understandable, and is it obvious it applies to the whole profile rather than one template? |
| A5 | Are the per-side TCP tuning fields (mss, initwnd, rxbufsize…) clearly optional? Does leaving them blank feel safe? |
| A6 | Is `rampup_sec` obviously a client-side-only concept? |
| A7 | With several templates, is the CPS-weighting relationship between them clear? |
| A8 | If GTP-U topology is enabled: is it clear a **companion `_topo.py`** is produced and must be loaded first? |

---

## 4. Edit task

> Here's an ASTF profile from last week. Add a second template on port 8080 at
> half the connection rate of the first.

**Watch for:** whether re-opening the profile preserves what they expect, and
whether they notice if anything silently reverted to defaults. (The GTP-U
topology block is known **not** to survive re-import — if their profile has one,
this is the moment that becomes visible. Log the tester's reaction; that gap is
documented in `js/core/import.js:732` and gated in T2.)

---

## 5. Results

```
Date:
Tester:
Author of this tab?   yes / no
Cold-start time:
Findings logged:      F___ .. F___
```
