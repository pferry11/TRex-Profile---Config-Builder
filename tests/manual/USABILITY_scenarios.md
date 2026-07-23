# Usability walkthrough — Scenarios

**Produces:** guided wizard bundles (profile + runbook)
**Budget:** ~20 min · **Method:** [README.md](README.md)

---

## 1. What this tab is really being judged on

Scenarios exists to be *easier* than the raw builders. If a tester finds it just
as effortful as the STL tab, the tab has failed at its own purpose — regardless
of whether every control works. Judge it against that bar.

## 2. Cold-start task

> Before we run any load test on this setup, we want to prove the basics work —
> that the link is up, that ARP resolves and that traffic actually gets to the
> other end. Set that up.

**Done when:** the tester has produced the connectivity-check bundle and can say
what to run first.

**Then a second, harder task:**

> Now ramp traffic up in four steps from low to high so we can see where it
> starts dropping.

---

## 3. Observation log

| Time | What the tester did / said | Hesitation? |
|---|---|---|
| | | |

Time to first correct output (task 1): ______
Time to first correct output (task 2): ______

---

## 4. Checkpoints

Common **U1–U10** — see [README.md](README.md). Plus:

| # | Checkpoint |
|---|---|
| N1 | Do the wizards feel like **guided flows**, or just like more forms with a different heading? Ask the tester directly. |
| N2 | Is it clear **which lab topology each scenario needs** (one box looped / a DUT / two boxes) *before* the tester invests in filling it in? Discovering "this needs a second box" at the end is a significant finding. |
| N3 | Is it obvious which generated file goes on which box for the two-server scenarios? |
| N4 | Does the NDR wizard explain what "no-drop rate" means and roughly how long it will take to run? |
| N5 | For the N-stage ramp: is the stage table easy to fill, and does the validation explain why non-increasing stages are rejected? |
| N6 | Is the runbook's ordering unambiguous — does the tester know what to run first, second, third? |
| N7 | Could the tester choose between the four scenarios without trying each one? |

---

## 5. Edit task

> Change the ramp from four stages to six.

**Watch for:** whether re-entering the wizard preserves their previous answers or
starts from scratch, and whether that matches what they expected.

---

## 6. Results

```
Date:
Tester:
Author of this tab?   yes / no
Cold-start time:
Findings logged:      F___ .. F___
```
