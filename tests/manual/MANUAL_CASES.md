# T6b — Manual functional cases (lab-blocked)

Numbered cases with expected results for the things the automated tiers cannot
reach. These are **written now and run when hardware allows** — the point is that
the gap is explicit and the case is ready, rather than the coverage silently
being absent.

For usability (as opposed to functional) coverage of these tabs, see
[USABILITY_tpg.md](USABILITY_tpg.md) and [USABILITY_bird.md](USABILITY_bird.md),
which need no lab and should be run every release.

---

## Why these are blocked

| Feature | Blocker |
|---|---|
| TPG | No hardware path currently available for tagged-packet-group receive stats. |
| BIRD | No veth-node host configured alongside a TRex box. |

Automated coverage that **does** exist for both: T0 goldens, T1 static validity
(JSON schema shape / BIRD brace balance and router id), T4 UI functional.
What is missing is only the "does it work on real kit" tier.

---

## TPG-01 — Tags file is accepted by the box

**Prerequisites:** TRex v3.06 running; the generated `*_tpg_tags.json` copied to
the box.

| # | Step | Expected result |
|---|---|---|
| 1 | Generate a Dot1Q tags file for VLANs 100–110 with `num_tpgids` covering the range. | Output pane shows valid JSON; no warnings. |
| 2 | Copy the file to the box at the path named in the runbook. | — |
| 3 | In `trex-console`, run the `tpg_enable` line from the generated runbook. | Command accepted, no error. TPG reports as enabled. |
| 4 | Start any STL profile that sends VLAN-tagged traffic across 100–110. | Traffic starts normally. |
| 5 | Run the `tpg_stats` line from the runbook. | Per-VLAN receive counters appear, one row per VLAN in range, non-zero for VLANs actually carrying traffic. |
| 6 | Run the `tpg_disable` line. | TPG reports disabled; no error. |

**Pass:** steps 3, 5 and 6 all succeed and step 5's counters match the VLANs
actually sent.

## TPG-02 — QinQ tags produce per-pair stats

As TPG-01, but with a QinQ tag set (inner/outer pairs). **Expected:** `tpg_stats`
reports per-pair rather than per-VLAN counters.

## TPG-03 — Warnings match real rejection

Generate a tags file that the app **warns** about (duplicate VLANs, or
`num_tpgids` below the tag count) and apply it anyway.

**Expected:** the box rejects it, or produces visibly wrong stats — i.e. the
app's warning was correct. If the box accepts it happily, the warning is a false
positive and should be logged as a finding.

---

## BIRD-01 — Generated config loads

**Prerequisites:** a veth node next to a TRex box, per the generated runbook.

| # | Step | Expected result |
|---|---|---|
| 1 | Generate a BGP config: local AS 65001, one neighbour, ~1000 static routes. | Output shows a `bird_*.conf` and a runbook; no warnings. |
| 2 | Set up the veth node following the runbook exactly. | Node comes up; interface has the configured IP. |
| 3 | Start BIRD with the generated config. | BIRD starts with **no config parse errors**. |
| 4 | `birdc show protocols` | The BGP protocol appears and reaches `Established` with the DUT. |
| 5 | `birdc show route count` | ~1000 routes present. |
| 6 | On the DUT, inspect the BGP table. | The advertised prefixes are received, matching the generated range. |

**Pass:** steps 3, 4 and 6 all succeed.

## BIRD-02 — OSPF and RIP variants

As BIRD-01 with OSPF (area 0) and then RIP. **Expected:** adjacency forms and
routes propagate in each case.

## BIRD-03 — IPv6 static routes

Generate a config with IPv6 static routes. **Expected:** BIRD parses it and the
v6 routes appear in `birdc show route`.

---

## Judgement checks (no lab needed, run every release)

| # | Check | Expected |
|---|---|---|
| J-01 | Manual tab screenshots vs current UI, tab by tab. | Match. If not, regenerate: `powershell -File tools\screenshots.ps1`. |
| J-02 | ⓘ tooltip text on a sample of ~20 fields across tabs. | Technically accurate against TRex v3.06 behaviour. |
| J-03 | Generated `# Summary:` lines for one profile per format (STL, ASTF, cap2, EMU, BIRD, cfg, CLI). | Reads as correct, plain English; describes what the profile actually does. |
| J-04 | README figures vs reality (test count, coverage baselines). | Match what T0/T2 report. Currently: 104 tests; cap2 67/67; STL 22/106; ASTF 65/98. |

---

## Recording results

Runs of these cases are recorded in [FINDINGS.md](FINDINGS.md) using the same
severity scale, tagged with the case id (e.g. `TPG-01`).
