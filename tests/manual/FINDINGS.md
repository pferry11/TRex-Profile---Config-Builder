# T6a — Usability findings log

One row per observation, from every walkthrough. See
[README.md](README.md) for the method.

## Severity

| Severity | Meaning | Action |
|---|---|---|
| **S1 Blocker** | Tester could not complete the task | Fix before next release |
| **S2 Friction** | Completed, but via a wrong turn or by consulting external docs | Roadmap row in `js/ui/manual.js` |
| **S3 Polish** | Completed smoothly; cosmetic or wording nit | Batch into a polish release |
| **S4 Note** | Observation or feature request | Roadmap candidate |

## Rules

- Log the observation, not the proposed fix. "Tester looked for the rate control
  under the packet section for 40s" beats "move the rate control".
- One row per observation. Do not merge two problems into one row.
- `Status` is `open`, `roadmap` (a row exists in `js/ui/manual.js`), `fixed`, or
  `wontfix` — with a reason for `wontfix`.

## Pass log

Record each walkthrough pass here so the traceability dashboard can show
staleness per tab.

| Date | Tab | Tester | Author of tab? | Cold-start time | Findings |
|---|---|---|---|---|---|
| _(no passes recorded yet)_ | | | | | |

## Findings

| ID | Date | Tab | Checkpoint | Severity | Observation | Status |
|---|---|---|---|---|---|---|
| _(none yet — first pass not run)_ | | | | | | |

<!--
Row template:
| F001 | 2026-07-30 | STL | U3 | S2 | Tester read "ISG" as "IP segment group"; took 90s and a Manual lookup to learn it is inter-stream gap. | open |
-->
