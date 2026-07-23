# Usability walkthrough — CLI Builder

**Produces:** `t-rex-64` launch script + matching `trex-console` command block
**Budget:** ~20 min · **Method:** [README.md](README.md)

---

## 1. Cold-start task

> Give me the exact command to start TRex in stateless mode on this box, running
> our imix profile for 60 seconds at 10% of line rate. I want to be able to
> paste it into a terminal.

**Done when:** the output shows a launch script and console block the tester
believes they could paste and run.

**Then a second task:**

> Now I need to capture the packets we're sending on port 0 so I can look at them
> in Wireshark — but only the DNS ones.

---

## 2. Observation log

| Time | What the tester did / said | Hesitation? |
|---|---|---|
| | | |

Time to first correct output (task 1): ______
Time to first correct output (task 2): ______

---

## 3. Checkpoints

Common **U1–U10** — see [README.md](README.md). Plus:

| # | Checkpoint |
|---|---|
| L1 | Are the generated commands **obviously runnable** — would the tester paste them into a production box without checking them first? |
| L2 | Is the split between the *launch script* (starts the daemon) and the *console block* (drives it) clear? Does the tester know they are two separate things run at different times? |
| L3 | Is the service-mode / capture block's purpose clear, and is it clear service mode must be turned **off** again? |
| L4 | Is the BPF filter field discoverable for the "only DNS" requirement, and is the syntax hinted at? |
| L5 | Are the STL vs ASTF mode differences reflected clearly (e.g. that `--astf-client-mask` is meaningless in STL)? |
| L6 | Do the warnings catch a bad combination *before* the tester copies the command? |
| L7 | Does the tester understand `-m` multiplier semantics well enough to set it confidently? |

---

## 4. Edit task

> Change it to run continuously instead of for 60 seconds.

**Watch for:** whether "leave duration blank" is a discoverable way to express
"forever", or whether the tester types 0 / -1 / a huge number.

---

## 5. Results

```
Date:
Tester:
Author of this tab?   yes / no
Cold-start time:
Findings logged:      F___ .. F___
```
