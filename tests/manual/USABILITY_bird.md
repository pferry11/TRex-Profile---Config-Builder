# Usability walkthrough — BIRD

**Produces:** BIRD routing configs (`bird_*.conf`) + veth-node runbook
**Budget:** ~20 min · **Method:** [README.md](README.md)

> **This tab has no lab tier.** BIRD cannot currently be exercised on hardware
> (see [MANUAL_CASES.md](MANUAL_CASES.md)), so this walkthrough plus T0/T1/T4 are
> its *entire* coverage. Run it carefully.

---

## 1. Cold-start task

> We're testing a router. We need TRex to peer with it over BGP from AS 65001 and
> advertise about a thousand routes, so we can see how the DUT copes with the
> table. Produce the config.

**Done when:** the output shows a BIRD config with a BGP protocol block, the
right AS numbers, and a generated static-route table of ~1000 routes.

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
| B1 | Is it clear that BIRD runs on a **veth node** alongside TRex, not inside it? |
| B2 | Is the router-id field's purpose clear, and is the validation message helpful when it's wrong? |
| B3 | Is the local-vs-neighbour AS distinction unambiguous (which side is TRex)? |
| B4 | Is the route-generation model clear — that one prefix + count expands into N routes? Does the tester predict correctly what 1000 routes will look like? |
| B5 | Is there a sensible cap/warning on route count, and does it explain the consequence rather than just refusing? |
| B6 | Are OSPF and RIP obviously optional alternatives to BGP rather than additions? |
| B7 | Is the runbook enough for someone who has never configured a veth node? |

---

## 4. Edit task

> Add a second BGP peer on a different subnet.

**Watch for:** whether the tester can tell the two peer blocks apart in the list
once both exist, and whether the naming convention helps or hinders.

---

## 5. Results

```
Date:
Tester:
Author of this tab?   yes / no
Cold-start time:
Findings logged:      F___ .. F___
```
