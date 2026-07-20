# TRex Profile & Config Builder

**App version 0.21.0** · Target: TRex v3.06

A lightweight web app that generates Cisco TRex v3.06 artifacts through
interactive forms — no install, no build step, no backend required.

## What it builds

| Tab | Output |
|---|---|
| **STL Profile** | Stateless traffic profiles (`.py`) — packet layers, TX modes, field-engine variables, flow/latency stats, tunables |
| **ASTF Profile** | Advanced stateful profiles (`.py`) — pcap replay lists or send/recv programs, CPS weights, TCP tuning, ramp-up |
| **cap2 (STF)** | Legacy pcap-replay YAML profiles with `dyn_pyload` payload manipulation |
| **EMU** | TRex-EMU client-emulation profiles (`.py`) — ARP/ICMP/IGMP/IPv6 ND/DHCPv4-v6/DNS/mDNS plugins + launch runbook |
| **TPG** | Tagged Packet Group tags file (`_tpg_tags.json`) for per-VLAN rx stats, with the `tpg_enable`/`tpg_stats` console runbook |
| **BIRD** | BIRD routing configs (`bird_*.conf`) — BGP/OSPF/RIP + generated static-route tables, with the veth-node console runbook |
| **Scenarios** | Guided wizards: connectivity check, two-server send/receive, N-stage connection ramp, NDR benchmark (profile + runbook bundles) |
| **Platform Config** | `trex_cfg.yaml` from the server registry (PCI, cores, MACs/IPs, NUMA) |
| **CLI Builder** | `t-rex-64` launch scripts + matching `trex-console` command blocks, including service-mode and packet-capture (record/monitor + BPF) blocks |
| **Settings** | Server registry, app defaults, and adjustable text size; workspace export/import as one JSON file |
| **Manual** | Built-in user manual: per-tab walkthroughs with screenshots, field reference tables, and a glossary |

Every artifact has Copy / Download buttons plus a downloadable JSON *model*
that can be re-imported and edited later, and a **Download bundle (.zip)** that
packs the artifact, its model, and any runbook together (dependency-free ZIP
writer, no toolchain). Generated file headers include the exact `stl-sim` /
`astf-sim` command to validate on a TRex box **and a plain-English `# Summary:`
of what the profile does** — the same summary shown live in the "What this does"
box above every output. Hover the ⓘ icons for field-by-field help.

STL `.py` profiles also gain a **Publish to server** action: point it at a
running [TRex-Backend](../TRex-Backend) host and the profile is POSTed to its
`/profiles/upload` endpoint, landing allowlisted in that box's dashboard —
`# Summary:` intact — so a teammate can run it without opening the builder.

All six profile builders keep **undo/redo** history (model snapshots, 50 deep),
and the workspace persists to **IndexedDB** (with localStorage migration and
fallback) so your work survives a reload.

## Run it

**Option A — no server:** open `index.html` in a browser. Everything works
from `file://`.

**Option B — hosted on the TRex box (extra features):**

```bash
pip install flask
TREX_DIR=/opt/trex/v3.06 python app.py     # then browse to http://<box>:8080
```

With the backend up, pcap path fields gain a **Browse…** button (lists real
pcaps under `TREX_DIR`) and STL/ASTF outputs gain **Validate on server**
(runs `stl-sim` / `astf-sim` and shows the result inline).

## Tests

Open `tests.html` in a browser — a self-contained golden-diff suite for all
generators (87 tests). No toolchain needed.

## Notes

- **App version** lives in `TB.APP_VERSION` (`js/app.js`) and shows in the
  header; bump the minor number with each feature release.
- Targets **TRex v3.06**; the generator registry is version-keyed so newer
  TRex versions can be added later without a rewrite — the Manual tab's
  **Future updates** chapter documents the exact steps, plus a roadmap of
  candidate improvements.
- Manual screenshots regenerate with `powershell -File tools\screenshots.ps1`
  (headless Edge) whenever the UI changes.
- Design and the phased build prompts used to create this app live in
  [`docs/DESIGN.md`](docs/DESIGN.md) and [`docs/BUILD_PROMPTS.md`](docs/BUILD_PROMPTS.md).
- The `v3.06/` folder (the TRex distribution used as format reference) is
  intentionally not committed.
