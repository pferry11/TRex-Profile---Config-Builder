# TRex Profile & Config Builder — Design Document

**Status:** Planning complete — ready to build via the phased prompts in [BUILD_PROMPTS.md](BUILD_PROMPTS.md)
**Target TRex version:** 3.06 (architecture is version-aware; 3.07/3.08 can be added later — see §7)
**Date:** 2026-07-06

---

## 1. What this tool is

A **lightweight static web application** (HTML/CSS/vanilla JavaScript, no backend, no build step) that helps a network engineer generate Cisco TRex artifacts through interactive forms:

| Generator | Output | Phase |
|---|---|---|
| STL profile builder | Stateless traffic profile (`.py`) | 1A |
| ASTF profile builder | Advanced stateful profile (`.py`) | 1B |
| Scenario wizards | Two-server & connection-ramp bundles (profile + runbook) | 1C |
| Settings + platform config | `trex_cfg.yaml` (PCI, cores, MACs/IPs, NUMA) | 2 |
| CLI command builder | `t-rex-64` command lines + `trex-console` commands | 3 |
| cap2 builder | Legacy pcap-replay YAML profiles | 4 |
| Flask wrapper | Same app served from the TRex box + validation API | 5 (future) |

The app opens directly from `file://` (or GitHub Pages). All output is **copy / download**; nothing is executed by the app itself. Every artifact also saves a re-editable JSON "model" so profiles can be reloaded and modified later.

## 2. Why static vanilla JS (no framework)

- The hard requirement is `file://` operation on any lab laptop, offline, zero install. Frameworks imply npm + bundlers + built artifacts.
- The app is forms + string generation + localStorage. Estimated 4–6k LOC total — below the threshold where a framework pays off.
- **Critical rule: no ES modules.** `<script type="module">` is blocked by CORS on `file://` in Chrome/Firefox. All code uses classic `<script>` tags loaded in dependency order, each file attaching to one global namespace `TB` (module pattern: `TB.gen.stl = (function(){ ... })()`).
- No CDN dependencies (offline use). Syntax highlighting is a small in-repo regex highlighter, not highlight.js.
- **Flask-ready:** the whole app is a static directory. Phase 5 adds `app.py` (`Flask(__name__, static_folder='.', static_url_path='')`) plus optional `/api/*` endpoints. The frontend probes `/api/ping`; when absent, backend-dependent features stay hidden. Nothing else ever assumes a server.

## 3. File layout

```
/index.html                 tab shell, loads all scripts in order
/css/app.css                single stylesheet
/js/core/util.js            TB.util: ids, IP/MAC validation, clipboard (with fallback), download
/js/core/store.js           TB.store: tiny pub/sub state
/js/core/persist.js         TB.persist: localStorage + workspace JSON export/import + quota guard
/js/core/settings.js        TB.settings: settings schema (servers, PCI, cores, pcap dir)
/js/gen/registry.js         TB.gen.registry: per-TRex-version generator registry
/js/gen/py.js               Python codegen primitives (literals, kwargs, argparse emitter)
/js/gen/stl.js              STL model -> .py          (registered under "3.06")
/js/gen/astf.js             ASTF model -> .py         (registered under "3.06")
/js/gen/yaml.js             minimal YAML emitter (leading-dash aware)
/js/gen/cfg.js              settings -> trex_cfg.yaml (Phase 2)
/js/gen/cli.js              CLI model -> command line (Phase 3)
/js/gen/cap2.js             cap2 model -> YAML        (Phase 4)
/js/ui/components.js        form-field factory, list editor, collapsible sections, tabs, modal
/js/ui/output.js            output pane: file tabs, highlight, Copy/Download/model-download
/js/ui/highlight.js         regex highlighter (python/yaml/shell)
/js/ui/stl_builder.js       STL tab       (1A)
/js/ui/astf_builder.js      ASTF tab      (1B)
/js/ui/scenarios.js         wizards tab   (1C)
/js/ui/settings_ui.js       settings menu (2)
/js/ui/cfg_builder.js       cfg tab       (2)
/js/ui/cli_builder.js       CLI tab       (3)
/js/ui/cap2_builder.js      cap2 tab      (4)
/js/app.js                  boot
/tests.html                 self-test page: golden-diff generator tests
/app.py                     Flask wrapper (Phase 5)
```

## 4. Cross-cutting conventions

1. **Generators are pure functions:** `model → { files: [{name, language, content}], warnings: [] }`. Warnings render as banners above output (e.g. duplicate latency pg_id).
2. **Every model** carries `{ kind, schemaVersion, trexVersion, meta: {name, description, modified} }`. Loaders refuse newer schemaVersions; older ones pass through migration functions.
3. **Every generated file header** (comment) states: generator name/version, date, target TRex version, the exact validation command (`./stl-sim -f x.py -o /tmp/o.pcap -l 50` or `./astf-sim -f x.py --full -o /tmp/`), and "re-edit by loading <name>.trexb.json".
4. **Three output actions everywhere:** Copy · Download artifact (`.py`/`.yaml`) · Download model (`<name>.trexb.json` — the re-editable source of truth).
5. **Persistence:** localStorage keys `trexb.settings.v1`, `trexb.profiles.v1`, `trexb.ui.v1`; a single "workspace" JSON export/import covers settings + all saved profiles; writes are quota-guarded with a visible error.

## 5. The two required scenarios

### 5.1 Two servers — one sends, one receives

Verified against the local v3.06 tree: the `_t-rex-64` binary accepts `--astf-server-only` and `--astf-client-mask <hex>`; the interactive API exposes `client_mask` (`automation/trex_control_plane/interactive/trex/astf/trex_astf_client.py:702`).

**Mechanism (default, ASTF):** both boxes load the **same profile**.
- Receiver box: `./t-rex-64 -i --astf --astf-server-only --cfg /etc/trex_cfg.yaml -c <cores>`
- Sender box: `./t-rex-64 -i --astf --astf-client-mask 0x1 --cfg /etc/trex_cfg.yaml -c <cores>`, then in `trex-console`: `start -f profile.py -m <mult> -d <dur>`

Correctness depends on the environment: the server box must own/answer the server-side `ip_gen` range (via `port_info` ip/gw or cross-wired MACs in each box's `trex_cfg.yaml`) and the ranges must be routable through the DUT. The wizard emits an explicit **pre-flight checklist** rather than pretending the app can verify this.

**Alternative (STL unidirectional):** TX-only STL profile on box A; box B runs `-i --stl` with no TX and measures via console stats/capture. Noted limitation: cross-chassis flow-stat/latency correlation is not automatic.

### 5.2 Connection ramp — low → mid → high

- **ASTF linear ramp:** `c_glob_info = ASTFGlobalInfo(); c_glob_info.scheduler.rampup_sec = N` (exact idiom in `v3.06/astf/param_sch_rampup.py`) — CPS grows linearly to the target.
- **ASTF discrete plateaus (recommended default):** profile whose base cps = low stage at `-m 1`; runbook gives a `trex-console` stepping sequence (`start -m 1`, wait, `stop`/`start -m <mid/low>`, …). Honest note: stepping restarts flows.
- **STL plateaus:** additive staggered-isg continuous streams — S1 = low pps @ isg 0; S2 = (mid−low) pps @ isg = stage1 duration; S3 = (high−mid) pps @ isg = stage1+stage2. Aggregate rate steps exactly low→mid→high.

The wizard is a mechanism radio + stage inputs, and emits profile + `RUNBOOK.txt` + model JSON, with "Open in builder" to keep editing.

## 6. Areas of concern (and mitigations)

1. **ES modules silently break on `file://`** → classic scripts + `TB` namespace rule; every phase's acceptance includes a `file://` smoke test in Chrome + Firefox.
2. **Browser cannot validate against real TRex libs** → embedded sim commands in every header; golden-diff `tests.html`; Phase 5 `/api/validate` runs sims server-side.
3. **Pcap paths can't be browsed from a static page** → text field + settings `pcapDir` prefix + datalist of well-known `avl/` pcaps; real fix in Flask phase (`/api/pcaps`).
4. **Tunables codegen complexity** → v1 tunables are typed scalars/choices bound to whitelisted fields (frame size, pps, cps, counts). `bench.py`-level structural tunables are explicitly v2.
5. **Schema drift across TRex versions** (3.07/3.08 exist today) → see §7.
6. **Correctness pitfalls encoded as generator warnings:**
   - `trex_cfg.yaml` and cap2 profiles are single-element YAML **lists** — the leading `- ` is mandatory or TRex rejects the file.
   - Latency `pg_id` must be unique per stream (auto-assign; convention `pg_id + port_id`).
   - Latency streams **ignore `-m`** — their pps is fixed in the profile.
   - cfg `dest_mac`/`src_mac` are cross-wired between paired ports.
   - Frames under 60 bytes need padding.
   - ASTF `cps` is a per-template **weight** scaled by `-m` at runtime — label it "cps (at -m 1)".
7. **localStorage ~5 MB limit / loss risk** → quota-guarded writes; workspace export/import JSON is the durable path; model download offered on every save.
8. **Two-chassis scenario has environment dependencies the app can't verify** → wizard emits a pre-flight checklist.
9. **Scapy coverage limits** → per-stream "raw scapy expression" escape hatch, emitted verbatim, marked unvalidated.
10. **Clipboard API fails off secure contexts** → `execCommand('copy')` fallback in `TB.util`.

## 7. Multi-version architecture (v3.06 now, 3.07/3.08+ later)

The app treats "target TRex version" as a first-class concept from day one, even though only 3.06 is implemented:

- Every artifact model carries `trexVersion: "3.06"`; settings hold a default target version; the UI shows a version selector (single option for now).
- **Per-version generator registry:** `TB.gen.registry["3.06"] = { stl, astf, cfg, cli, cap2 }`. Supporting 3.07 later = register `TB.gen.registry["3.07"]` that delegates to the 3.06 functions and overrides only the deltas via a capability/quirk table (new CLI flags, new ASTF fields, changed defaults). No UI or model rewrite.
- UI field definitions carry optional `sinceVersion`/`untilVersion` metadata so version-specific fields appear/hide automatically.
- Golden test fixtures are organized per version; `tests.html` runs the suite for each registered version.
- Generated headers always state the target version.

## 8. Verification strategy

**Layer 1 — in-browser (`tests.html`, no toolchain):** fixture model JSONs → generator → string-diff against embedded golden outputs (hand-ported equivalents of shipped v3.06 examples: STL `udp_1pkt_simple`, `imix`, `multi_burst_2st_1000pkt`, `flow_stats_latency`; ASTF `http_simple`, `http_manual_commands(_loop)`, `param_sch_rampup`, `template_groups`; cfg `simple_cfg`, `xl710`, `x710_advance_more_flows`; cap2 `dns`, `dyn_pyld1`). Plus round-trip tests: model → save → load → regenerate → identical.

**Layer 2 — on the TRex box (manual per phase):**
- STL: `./stl-sim -f generated.py -o /tmp/gen.pcap -l 50` (exit 0; eyeball pcap); tunables path: `-t size=128`.
- ASTF: `./astf-sim -f generated.py --full -o /tmp/` (and `--json` to inspect compiled profile).
- cfg: `python -c "import yaml; yaml.safe_load(open('generated.yaml'))"` + field-by-field eyeball vs `v3.06/cfg/` examples, then a real `t-rex-64 --cfg` start.
- Scenario A: bring up both boxes per runbook, confirm connections establish end-to-end.
- Scenario B: watch cps/active-flows step low→mid→high in the trex-console TUI.

**Layer 3 — faithfulness:** the generated `http_simple` equivalent must be semantically identical to `v3.06/astf/http_simple.py` (same ip_gen values, cps, cap file) even where formatting differs.

## 9. Reference files in this repo

| File | Why it matters |
|---|---|
| `v3.06/astf/http_simple.py` | Canonical ASTF pcap-mode profile; Phase 1B golden |
| `v3.06/astf/param_sch_rampup.py` | Exact `scheduler.rampup_sec` idiom for the ramp wizard |
| `v3.06/astf/http_manual_commands.py`, `..._loop.py` | Program mode; loops via set_var/set_label/jmp_nz |
| `v3.06/astf/template_groups.py` | Multi-template cps weights + association rules |
| `v3.06/astf/http_simple_split.py`, `..._split_per_core.py` | Dual-port / per-core IP distribution |
| `v3.06/stl/udp_1pkt_simple.py` | Minimal STL profile shape |
| `v3.06/stl/imix.py` | Size/pps/isg table + STLVM src/dst vars |
| `v3.06/stl/bench.py` | Richest tunables/VM/flow-stats idioms |
| `v3.06/stl/multi_burst_2st_1000pkt.py` | Stream chaining (name/next/self_start) |
| `v3.06/stl/flow_stats_latency.py` | Latency stats + pg_id conventions |
| `v3.06/cfg/simple_cfg.yaml`, `xl710.yaml`, `x710_advance_more_flows.yaml` | trex_cfg.yaml shapes (IP mode, platform, 2-socket+memory) |
| `v3.06/cap2/dns.yaml`, `dyn_pyld1.yaml`, `sfr.yaml` | cap2 schema incl. dyn_pyload |
| `v3.06/automation/trex_control_plane/interactive/trex/astf/trex_astf_client.py` | `client_mask` semantics (line 702) |

## 10. How to build it

Work through [BUILD_PROMPTS.md](BUILD_PROMPTS.md) in order (1A → 1B → 1C → 2 → 3 → 4 → 5). Each prompt is self-contained — paste it into a fresh AI coding session. After each phase, run that phase's acceptance checks (and the on-box sim validation when possible) before starting the next.
