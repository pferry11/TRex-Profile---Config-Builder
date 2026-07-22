# TRex Profile & Config Builder

**App version 0.27.6** · Target: TRex v3.06

A lightweight web app that generates Cisco TRex v3.06 artifacts through
interactive forms — no install, no build step, no backend required.

## What it builds

| Tab | Output |
|---|---|
| **STL Profile** | Stateless traffic profiles (`.py`) — packet layers, TX modes, field-engine variables, flow/latency stats, tunables |
| **ASTF Profile** | Advanced stateful profiles (`.py`) — pcap replay lists or send/recv programs, CPS weights, TCP tuning, ramp-up |
| **cap2 (STF)** | Legacy pcap-replay YAML profiles with `dyn_pyload` payload manipulation — and **re-import**: load a generated (or hand-written) `.yaml` back into the builder |
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

**Re-editing generated files:** the profile file itself is enough to reload —
you don't need to keep the sidecar `.json`. The **cap2** tab's **Import…**
button accepts a generated `.yaml` as well as a `.json` model, and **values are
read straight from the file body**, so any edit you made (a changed IP or rate)
comes back in — the body is the single source of truth, with no hidden copy to
drift out of sync. A one-line tag at the foot of the file
(`# trexb: cap2 schemaVersion=1`) just marks it as tool-generated and names the
field map; it holds no values. A file this tool made maps fully; a hand-written
or third-party `.yaml` with no tag is parsed best-effort, loading every key it
recognizes and reporting how much of the file could be mapped. The app has no
interpreter and won't try to understand arbitrary scripts, so only tool-generated
files are guaranteed to map fully. The **STL** tab now re-imports generated `.py`
profiles the same way, via its own **Open profile…** action — a profile made in
the tool round-trips byte-identically. Hand-written STL is arbitrary Python, so it
maps best-effort: the parser follows the common shipped shapes (local
`base_pkt`/`pkt`/`vm` assignments, fluent and low-level field engines, multi-stream
`STLProfile([...])` lists), and preserves anything it can't resolve statically as a
raw-scapy expression. The realistic route to loading *every* shipped example is a
backend Python resolver that executes rather than parses. The **ASTF** tab now
re-imports generated `.py` profiles too, via its own **Open profile…** — a profile
made in the tool round-trips byte-identically (ip generator, per-side TCP tuning,
the payload pool, program command lists, and the template wiring all come back).
Hand-written ASTF now maps best-effort offline too — the shipped files are mostly
structurally close to the tool's own output, so the parser recovers ip generator,
global-info, pcap lists and program templates from most of them. And — exactly
like STL — with the Flask backend up, **Open profile…** *executes* the profile
server-side, so profiles that compute values from argparse tunables, conditionals
or loops load faithfully too. Re-import for every profile format (cap2, STL, ASTF)
is now in place.

## Run it

**Option A — no server:** open `index.html` in a browser. Everything works
from `file://`.

**Option B — hosted on the TRex box (extra features):**

```bash
pip install flask
TREX_DIR=/opt/trex/v3.06 python app.py     # then browse to http://<box>:8080
```

With the backend up, pcap path fields gain a **Browse…** button (lists real
pcaps under `TREX_DIR`), STL/ASTF outputs gain **Validate on server** (runs
`stl-sim` / `astf-sim` and shows the result inline), and the **STL** and **ASTF**
tabs' **Open profile…** switches to a **server resolver** that *executes* the
profile (`POST /api/import_profile` → `tools/stl_resolve.py` / `tools/astf_resolve.py`)
instead of parsing it — so arbitrary hand-written Python (comprehensions,
`__init__` tables, argparse tunables, conditionals, loops) loads faithfully. It
falls back to the offline parser automatically when the backend is absent or
can't resolve a file.

## Tests

Open `tests.html` in a browser — a self-contained golden-diff suite for all
generators (103 tests). No toolchain needed.

## Notes

- **App version** lives in `TB.APP_VERSION` (`js/app.js`) and shows in the
  header; bump the minor number with each feature release.
- Targets **TRex v3.06**; the generator registry is version-keyed so newer
  TRex versions can be added later without a rewrite — the Manual tab's
  **Future updates** chapter documents the exact steps, plus a roadmap of
  candidate improvements.
- Manual screenshots regenerate with `powershell -File tools\screenshots.ps1`
  (headless Edge) whenever the UI changes.
- `node tools/cap2_import_coverage.js` measures how much of the shipped v3.06
  cap2 profiles the importer can map back into editable models (needs a local
  `v3.06/` tree) — the objective metric when closing cap2 import-fidelity gaps.
  As of v0.25.0 all **67/67** shipped cap2/avl profiles round-trip at 100%,
  including the per-template named generator pools (`generator_clients`/
  `generator_servers`, per-template `client_pool`/`server_pool`, `track_ports`).
- `node tools/stl_import_coverage.js` is the equivalent for STL `.py` (needs the
  `v3.06/stl/` tree). The offline parser maps our own generated shape at 100%;
  for the shipped hand-written corpus it is best-effort — as of v0.26.4 (3b) it
  fully maps **22 of 106** files and partially extracts streams from most of the
  rest (following `base_pkt`/`pkt`/`vm` assignments, the fluent `STLVM` and
  low-level `STLScVmRaw` field engines, and multi-stream `STLProfile([...])`
  lists). Packets built by a function call or comprehension can't be resolved
  statically and are preserved as raw-scapy — full corpus coverage is a job for
  the backend Python resolver (execute-not-parse), not static parsing.
- `python tools/stl_resolve.py <profile.py>` is that resolver (v0.26.5, 3c): it
  *executes* the profile against a lightweight recording stand-in for the TRex
  API plus real scapy, and prints an editable builder model. Because it runs the
  profile the way TRex does, it handles the arbitrary Python the static parser
  can't — over the shipped corpus it resolves **72 of 106** files (the 24 HLT-API
  profiles use a different builder and fall back to offline; a few IPv6 files need
  a Linux network stack). It needs only scapy, not a full TRex install, and the
  Flask backend exposes it at `POST /api/import_profile`.
- `node tools/astf_import_coverage.js` is the ASTF equivalent (needs `v3.06/astf/`).
  The offline parser round-trips our own generated shape 100%, and — because the
  shipped ASTF files are largely structural — as of v0.27.5 (A3b) it fully maps
  **65 of 98** shipped files and partially maps most of the rest. The ~33 it can't
  fully map compute values from argparse tunables / conditionals, which is what the
  execute-not-parse resolver closes.
- `python tools/astf_resolve.py <profile.py>` is that resolver (v0.27.6, A3c): the
  ASTF counterpart of `stl_resolve.py`, it executes the profile against recording
  stand-ins for the ASTF API (+ real scapy) and prints an editable builder model.
  It resolves **85 of 98** shipped files — the tunable/conditional ones included;
  the remaining handful have no `register()` or use exotic API surface. Wired at
  `POST /api/import_profile` (kind `astf`), with the STL resolver.
- Design and the phased build prompts used to create this app live in
  [`docs/DESIGN.md`](docs/DESIGN.md) and [`docs/BUILD_PROMPTS.md`](docs/BUILD_PROMPTS.md).
- The `v3.06/` folder (the TRex distribution used as format reference) is
  intentionally not committed.
