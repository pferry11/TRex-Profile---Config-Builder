# Usability walkthrough — TPG

**Produces:** a Tagged Packet Group tags file (`_tpg_tags.json`) + console runbook
**Budget:** ~20 min · **Method:** [README.md](README.md)

> **This tab has no lab tier.** TPG cannot currently be exercised on hardware
> (see [MANUAL_CASES.md](MANUAL_CASES.md)), so this walkthrough plus the
> automated T0/T1/T4 tiers are its *entire* coverage. Run it carefully.

---

## 1. Cold-start task

> We want per-VLAN receive statistics: for VLANs 100 through 110, we need to know
> how many packets came back on each one. Set that up.

**Done when:** the output shows a tags JSON covering the VLAN range and the
tester has found the `tpg_enable` / `tpg_stats` runbook.

**Watch for specifically:** TPG is niche. Assume the tester has never used it.
The real question is whether the tab teaches enough to be usable by someone who
only knows *what they want*, not *what TRex calls it*.

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
| T1 | Could the tester explain what a "tagged packet group" is *after* using the tab? |
| T2 | Is the Dot1Q-range vs QinQ-pair distinction clear? |
| T3 | Is `num_tpgids` explicable — does the tester understand what number to put there and why? |
| T4 | Is the runbook sufficient for someone who has never run `tpg_enable`? Would they know the order of operations? |
| T5 | Is it clear the JSON file must be placed somewhere specific on the box? |
| T6 | The tags file is JSON, so it carries **no `# Summary:` comment** (JSON has no comment syntax) — the summary lives in the runbook instead. Does the tester find the explanation, or does the artifact feel unexplained? |

---

## 4. Edit task

> Add QinQ tags with outer VLAN 200 to the same file.

**Watch for:** TPG has no re-import path. Same question as EMU — does the tester
expect one?

---

## 5. Results

```
Date:
Tester:
Author of this tab?   yes / no
Cold-start time:
Findings logged:      F___ .. F___
```
