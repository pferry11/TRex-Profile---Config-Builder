# Usability walkthrough — Manual

**Produces:** nothing — it is the built-in documentation
**Budget:** ~15 min · **Method:** [README.md](README.md)

---

## 1. What this tab is judged on

The Manual is the app's safety net: it is where testers land when a tab failed
to explain itself. Two things matter — **can you find an answer quickly**, and
**is the answer still true**.

Screenshot staleness is the specific risk. Screenshots regenerate with
`powershell -File tools\screenshots.ps1` whenever the UI changes; if that step
is skipped, the Manual actively misleads.

## 2. Cold-start tasks

Run these as **lookup races** — time each one separately. Target: under a minute.

| # | Task | Time |
|---|---|---|
| M1 | Find out what "ISG" means and which tab uses it. | |
| M2 | Find out how to add support for a new TRex version. | |
| M3 | Find out what the `# trexb:` line at the bottom of a generated file is for. | |
| M4 | Find out which scenarios need two TRex boxes. | |
| M5 | Find out how to turn on the pcap Browse… button. | |

---

## 3. Checkpoints

Common **U1–U10** — see [README.md](README.md). Plus:

| # | Checkpoint |
|---|---|
| D1 | **Do the screenshots match the current UI?** Go tab by tab and compare. Any mismatch is at least S3, and S2 if it would mislead. |
| D2 | Can a specific field be found via the field-reference tables in under a minute? |
| D3 | Is the chapter list navigable, or does the tester resort to Ctrl-F? (Ctrl-F is not automatically a failure — note whether it worked.) |
| D4 | Is the glossary complete enough for the terms the other walkthroughs exposed as confusing? Cross-check against open S2 findings in [FINDINGS.md](FINDINGS.md). |
| D5 | Is the *Future updates* roadmap comprehensible to a reader who isn't a maintainer? |
| D6 | Does the *Self tests* chapter make clear how to run the tests and when? |
| D7 | Is anything in the Manual **factually wrong** now — stale counts, renamed controls, removed features? |

---

## 4. Cross-check task

This tab is the right place to close the loop on the rest of the pass:

> For every S2 "needed external docs" finding logged during this release's
> walkthroughs, check whether the Manual **already** answered it.

- If it did → the finding is really a *discoverability* problem in the tab, not
  a documentation gap. Re-classify it and note that in the finding row.
- If it didn't → the Manual has a gap; log a separate finding against this tab.

---

## 5. Results

```
Date:
Tester:
Author of this tab?   yes / no
Lookup times:         M1 ___  M2 ___  M3 ___  M4 ___  M5 ___
Screenshots current?  yes / no
Findings logged:      F___ .. F___
```
