# T6a — Manual usability walkthroughs

Eleven walkthroughs, one per tab. They are **not** pass/fail tests. Their output
is a findings log: [FINDINGS.md](FINDINGS.md).

## Why these exist when T4 already drives the UI

The automated UI tier (`tests/robot/suites/t4_ui_functional.robot`) asserts that
a control exists and does what the code says. It cannot tell you that a label is
confusing, that a default is wrong, that the flow has a dead end, or that a
warning says *what* is broken but not *what to do about it*. That is where most
end-user pain actually lives, and a human is the only instrument for it.

## The single most important rule

**The tester should not be the person who built the tab.** A fresh tester is the
entire value of this exercise. Someone who already knows where the controls are
will find wording nits and layout glitches, and will systematically miss the
discoverability problems — which are the expensive ones.

If no fresh tester is available, run it anyway, but record `tester: author` in
the results block so the findings are read with that discount applied.

## Method — the same five parts on every tab

1. **Cold-start task.** Stated in the *tester's* language, never the app's. The
   tester gets the goal and nothing else: no hints about which controls to use,
   no pointer to the Manual tab. Start a timer.
2. **Timed observation.** Record time-to-first-correct-output, and every point
   where the tester hesitated, backtracked, guessed wrong, or asked a question.
   The hesitations are the data — not the completion time.
3. **Checkpoints.** The ten common ones below, plus the per-tab additions in
   each walkthrough file.
4. **Edit an existing artifact.** Re-open something already generated and change
   one value. This is where the *profile* (`.py` / `.yaml`) vs *builder file*
   (`.trexb.json`) distinction gets tested — two different output-pane actions
   that testers are likely to confuse.
5. **Log findings.** Every observation goes into [FINDINGS.md](FINDINGS.md) with
   a severity. An observation that isn't logged didn't happen.

## The ten common checkpoints

| # | Checkpoint |
|---|---|
| U1 | Is it obvious what this tab produces, before generating anything? |
| U2 | Are the default values sensible enough to generate something useful immediately? |
| U3 | Does every field label read correctly to a network engineer (not a developer)? |
| U4 | Is the ⓘ tooltip text sufficient, or did the tester need external TRex docs? |
| U5 | Do warnings say what is wrong **and** what to do about it? |
| U6 | Is the *What this does* summary accurate and in plain English? |
| U7 | Are the output-pane actions distinguishable (Copy / Download / bundle / builder file / Open profile / Validate / Publish)? |
| U8 | Does undo/redo behave as the tester expects after a multi-field edit? |
| U9 | Any layout problems — overflow, clipped controls, unusable list columns — at 1366px, 1920px and 2560px? |
| U10 | Did anything require reading the Manual tab that shouldn't have? |

## Cadence

- **Full pass** (all 11 tabs) — once per release batch. Budget ~20 min per tab.
- **Reduced pass** — only the touched tabs, per feature.

## Feeding findings back

S1 and S2 findings become rows in the roadmap table — the `rows` array in
`js/ui/manual.js` (Manual tab → *Future updates*). That is the project's single
tracker; this exercise does not get a second backlog.

## A note on interpreting a clean run

A full 11-tab pass that produces **zero findings is evidence the tasks were too
leading**, not that the UI is perfect. Rewrite the tasks and run it again.

## Where the tabs are covered elsewhere

| Tab | Automated tiers covering it |
|---|---|
| STL, ASTF | T0, T1, T2, T4, T5 (real traffic) |
| cap2 | T0, T1, T2, T4, T5 |
| EMU | T0, T1, T4, T5 |
| Platform Config, CLI | T0, T1, T4, T5 (launch path) |
| Scenarios | T0, T1, T4, T5 (dual-box) |
| **TPG, BIRD** | T0, T1, T4 only — **no lab path**, see [MANUAL_CASES.md](MANUAL_CASES.md) |
| Settings, Manual | T0 (settings unit tests), T4 |
