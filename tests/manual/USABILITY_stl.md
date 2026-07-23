# Usability walkthrough — STL Profile

**Produces:** a stateless traffic profile (`.py`)
**Budget:** ~20 min · **Method:** [README.md](README.md)

---

## 1. Cold-start task

Read this to the tester verbatim. Do **not** name any control, and do not point
at the Manual tab. Start the timer.

> We need a traffic profile that sends 64-byte UDP packets at 1 Gbps out of
> port 0, where the source IP cycles through a /24 so the DUT sees many
> different flows rather than one. Produce the file we'd copy to the TRex box.

**Done when:** the output pane shows a profile with a continuous stream, a
64-byte frame, a rate expressed in bps (not pps), and a field-engine variable
sweeping the source IP.

**Watch for specifically:**
- Do they find the rate *unit* selector, or do they type 1000000000 into a pps
  box? (Typing a huge pps number is a wrong turn worth logging.)
- How long before they realise the IP sweep lives in a "field engine" /
  "VM variables" concept at all?

---

## 2. Observation log

| Time | What the tester did / said | Hesitation? |
|---|---|---|
| | | |

Time to first correct output: ______

---

## 3. Checkpoints

Common **U1–U10** — see [README.md](README.md). Plus, specific to this tab:

| # | Checkpoint |
|---|---|
| S1 | Is the field-engine (VM variable) editor comprehensible **without** prior TRex API knowledge? Could the tester explain what `min`/`max`/`step`/`write to` do after using it once? |
| S2 | Is the rate-unit selector (pps / bps L1 / bps L2 / % line rate) unambiguous? Does the tester know which one their requirement maps to? |
| S3 | Does the **IMIX preset** button land where expected, and is it obvious what it did to the stream list? |
| S4 | With multiple streams, is it clear which one the editor is currently editing? |
| S5 | Are TX modes (continuous / single burst / multi burst) distinguishable without trying each? |
| S6 | Is it clear what flow-stats vs latency stats give you, and that they need a `pg_id`? |
| S7 | Does the packet-size readout make the relationship between headers and frame size clear? |

---

## 4. Edit task

> Here is a profile we generated last week. Change the rate to 2 Gbps and
> regenerate it.

Hand the tester **only the `.py` file** (not the `.trexb.json`).

**Watch for:** do they reach for *Open profile…* or *Open builder file…*? Getting
this wrong is the naming problem we most expect to find. Log which one they tried
first, regardless of whether they recovered.

---

## 5. Results

```
Date:
Tester:
Author of this tab?   yes / no
Cold-start time:
Findings logged:      F___ .. F___
```
