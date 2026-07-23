# Usability walkthrough — Settings

**Produces:** server registry, app defaults, display settings, workspace export/import
**Budget:** ~15 min · **Method:** [README.md](README.md)

---

## 1. Cold-start task

> Add our second lab box to the app so it shows up when we're building platform
> configs. While you're there, the text is too small on this monitor — fix that.

**Done when:** a second server exists in the registry and appears in the Platform
Config tab, and the text scale has changed.

**Then a second task, which is the one that matters most:**

> I'm moving to a different laptop. Get everything you've set up here onto it.

**Watch for:** does the tester find workspace export/import at all? This is the
only route to moving work between machines, and losing a workspace is the most
expensive failure the app can inflict on someone.

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
| G1 | Are **workspace export/import** findable? Did the tester look in Settings, or in the header, or give up? |
| G2 | Is it clear what a workspace export contains (settings **and** saved profiles), and what it doesn't? |
| G3 | Does import make clear whether it merges or replaces? Is that behaviour what the tester expected? |
| G4 | Do the text-size controls preview convincingly — can the tester tell what "field names" vs "controls" vs "generated output" cover without trial and error? |
| G5 | Does the accent-colour picker preview well, and is it obvious the change is global? |
| G6 | Is the server registry's relationship to the Platform Config tab clear? |
| G7 | Is it clear that everything persists automatically (IndexedDB) and that no "save" is needed? |
| G8 | Is the storage-usage indicator (bottom of the tab) meaningful to the tester? |

---

## 4. Destructive-path check

Ask the tester what they would expect to happen if they imported a workspace over
existing work. **Then let them try it** — on a throwaway workspace, having
exported first.

If the tester's expectation and the actual behaviour differ, that is an **S1 or
S2** finding regardless of which behaviour is "correct" — silent data loss is the
worst outcome in this app.

---

## 5. Results

```
Date:
Tester:
Author of this tab?   yes / no
Cold-start time:
Findings logged:      F___ .. F___
```
