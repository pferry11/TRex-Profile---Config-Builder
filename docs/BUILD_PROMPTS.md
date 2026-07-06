# TRex Profile & Config Builder — AI Build Prompt Series

How to use this document: work through the prompts **in order** (1A → 1B → 1C → 2 → 3 → 4 → 5). Each prompt is self-contained — copy everything inside its "PROMPT" section into a fresh AI coding session, pointed at your project repo. After each phase, run the acceptance checks at the end of the prompt (and, when you have access to a TRex box, the simulator validation) before starting the next phase.

Prompts 1B onward assume the previous phases' code exists in the repo, so run them in the same repo the earlier phase produced.

See [DESIGN.md](DESIGN.md) for the full design rationale, areas of concern, and multi-version architecture.

---
---

## PROMPT 1A — App shell + STL profile builder

Build the first phase of a **static web application** called "TRex Profile & Config Builder". It helps a network engineer generate Cisco TRex v3.06 **stateless (STL) traffic profiles** (Python files) through interactive forms. The app must run when `index.html` is opened directly from `file://` in Chrome and Firefox — no server, no build step, no npm, no CDN.

### Ground rules (non-negotiable)

1. **No ES modules.** `<script type="module">` fails on `file://` due to CORS. Use classic `<script>` tags loaded in dependency order in `index.html`. Each JS file attaches to a single global namespace `TB` using the module pattern, e.g. `TB.gen = TB.gen || {}; TB.gen.stl306 = (function(){ ...; return api; })();`
2. **No external dependencies of any kind** — no CDN scripts, fonts, or stylesheets. Everything in-repo. Syntax highlighting is a small (~60 line) regex-based highlighter you write for Python/YAML/shell.
3. **Generators are pure functions:** `generate(model) → { files: [{name, language, content}], warnings: [string] }`. Warnings render as a banner above the output pane.
4. **Target-version architecture:** the app targets TRex **v3.06** but must be version-extensible. Create `TB.gen.registry = { "3.06": { stl: <fn> } }`. All UI code resolves generators through the registry using the model's `trexVersion`. A version selector appears in the header (single option "3.06" for now). Adding "3.07" later must require only registering a new generator set — no UI or model changes.
5. **Every saved model** carries `{ kind, schemaVersion: 1, trexVersion: "3.06", meta: {name, description, modified} }`. Loaders reject a higher schemaVersion with a clear message.
6. **Every generated file starts with a comment header**: tool name, generation date, `Target: TRex v3.06`, the exact validation command (for STL: `# validate on the TRex box: ./stl-sim -f <name>.py -o /tmp/out.pcap -l 50`), and `# re-edit: load <name>.trexb.json in TRex Profile & Config Builder`.
7. **Three output actions on every result:** Copy (with `navigator.clipboard` + `document.execCommand('copy')` fallback for `file://`), Download artifact (`.py`), Download model (`<name>.trexb.json`).
8. **Persistence:** localStorage keys `trexb.settings.v1`, `trexb.profiles.v1`, `trexb.ui.v1`. Quota-guard all writes (try/catch, visible error toast). Provide workspace **Export/Import** buttons (single JSON containing settings + all saved profiles).

### File layout to create

```
/index.html            tab shell (tabs: STL Profile | ASTF Profile | Scenarios | Settings — only STL active; others show "coming in a later phase")
/css/app.css           single stylesheet, clean dark theme, CSS variables
/js/core/util.js       TB.util: uid(), ipv4/ipv6/mac validators, clipboard copy w/ fallback, downloadText(name, content), deepClone
/js/core/store.js      TB.store: minimal pub/sub state container
/js/core/persist.js    TB.persist: localStorage wrapper + workspace export/import + quota guard
/js/core/settings.js   TB.settings: settings schema + accessors (defaults only; the settings UI is a later phase). Schema: { schemaVersion:1, defaults:{ trexVersion:"3.06", pcapDir:"/opt/trex/v3.06/avl" }, servers:[] }
/js/gen/registry.js    TB.gen.registry per ground rule 4
/js/gen/py.js          TB.gen.py: Python codegen helpers — pyLiteral(value), kwargs formatting, indented block builder, header-comment builder, argparse block emitter from a tunables table
/js/gen/stl.js         TB.gen: STL model → .py (registered under "3.06")
/js/ui/components.js   TB.ui: field factory (text/int/float/select/checkbox/ip/mac with inline validation + optional "bind to tunable" toggle), sortable list editor, collapsible section, tab bar, modal, toast
/js/ui/highlight.js    TB.ui.highlight(code, language) for python/yaml/shell
/js/ui/output.js       TB.ui.output: output pane with per-file tabs, highlighted <pre>, warning banner, the 3 actions from ground rule 7
/js/ui/stl_builder.js  the STL tab
/js/app.js             boot: render tabs, restore UI state
/tests.html            self-test page (see Acceptance)
```

### STL profile model (the JSON the UI edits and the generator consumes)

```json
{ "kind":"stl", "schemaVersion":1, "trexVersion":"3.06",
  "meta": {"name":"my_profile","description":"","modified":"<iso date>"},
  "tunables": [ {"name":"size","type":"int","default":64,"help":"frame size"} ],
  "streams": [ {
    "id":"s1", "name":"S0", "enabled":true,
    "packet": {
      "l2": {"srcMac":null,"dstMac":null},
      "vlan": {"enabled":false,"id":100,"prio":0},
      "l3": {"type":"ipv4","src":"16.0.0.1","dst":"48.0.0.1","tos":null,"ttl":null},
      "l4": {"type":"udp","sport":1025,"dport":12,"tcpFlags":null},
      "payload": {"mode":"pad","frameSize":64,"frameSizeTunable":null,"fill":"x","rawScapy":null}
    },
    "mode": {"type":"cont","pps":100,"totalPkts":null,"pktsPerBurst":null,"ibgUsec":null,"count":null},
    "isgUsec": 0.0,
    "chain": {"selfStart":true,"next":null,"actionCount":null},
    "vm": { "cacheSize":null,
      "vars":[ {"name":"ip_src","sizeBytes":4,"op":"inc","min":"16.0.0.1","max":"16.0.0.254","step":1,"writeTo":"IP.src","fixChecksum":true} ],
      "tuple": {"name":"tuple","ipMin":"16.0.0.1","ipMax":"16.0.0.2","portMin":1025,"portMax":2048,"limitFlows":10000,"writeIpTo":"IP.src","writePortTo":"UDP.sport"} },
    "flowStats": {"type":"none","pgId":null,"addPortId":false}
  } ] }
```

Notes: `mode.type` ∈ `cont | single_burst | multi_burst` (fields used per type: cont→pps; single_burst→pps,totalPkts; multi_burst→pps,pktsPerBurst,ibgUsec,count). `l3.type` ∈ `ipv4|ipv6`; `l4.type` ∈ `udp|tcp|none`. `vm.tuple` is null unless used. `payload.rawScapy`, when set, replaces the whole scapy expression for that stream (power-user escape hatch — emit verbatim with a `# UNVALIDATED raw scapy` comment). `flowStats.type` ∈ `none|stats|latency`.

### STL builder UI

Three-pane layout: **stream list** (left: add / duplicate / reorder / delete / enable-toggle) | **stream editor** (center) | **live output pane** (right, regenerates on every change).

Profile-level bar (top): name, description, target version selector, **tunables table** (name, type int/float/str/choice, default, help). Numeric fields in the stream editor get a small "⚙" toggle that binds the field to a tunable (stores the tunable name, e.g. `frameSizeTunable`); the generator then emits `args.<name>` instead of the literal.

Stream editor sections (collapsible):
1. **Packet** — L2 (optional src/dst MAC), VLAN (off / Dot1Q id+prio), L3 (IPv4 src/dst/tos/ttl or IPv6 src/dst), L4 (UDP sport/dport | TCP sport/dport/flags | none), payload (pad-to-frame-size with fill char, or raw scapy expression). Show a live computed packet-size readout; warn below 60 bytes.
2. **TX mode** — cont(pps) | single burst(pps, total_pkts) | multi burst(pps, pkts_per_burst, ibg µs, count).
3. **Timing & chaining** — isg (µs), self_start checkbox, `next` dropdown (other stream names), action_count (loop count; hint: used with `next` looping back, 0 = infinite).
4. **Field engine (VM)** — list of scalar vars (name, size 1/2/4/8 bytes, op inc/dec/random, min, max, step, write-target dropdown: `IP.src`, `IP.dst`, `UDP.sport`, `UDP.dport`, `IP.tos`, custom offset; per-var fix-IPv4-checksum flag) + optional tuple generator (ip min/max, port min/max, limit_flows, write targets) + cache size.
5. **Flow stats** — none | stats (pg_id) | latency (pg_id). Auto-suggest a unique pg_id; "add port_id to pg_id" checkbox. When latency selected show info notes: *latency streams ignore the `-m` multiplier* and *each latency stream needs a unique pg_id*.

Save/Load: profiles save into localStorage (`trexb.profiles.v1`, keyed list with kind+name); a "Profiles" dropdown lists saved models; Import model JSON button.

### Codegen contract (what the generator must emit)

Shape of generated file — header comment, then:

```python
from trex_stl_lib.api import *
import argparse


class STLGenProfile(object):

    def create_stream_1(self, args):
        base_pkt = Ether()/IP(src="16.0.0.1",dst="48.0.0.1")/UDP(dport=12,sport=1025)
        pad = max(0, args.size - len(base_pkt)) * 'x'
        vm = STLVM()
        vm.var(name="ip_src", min_value="16.0.0.1", max_value="16.0.0.254", size=4, op="inc", step=1)
        vm.write(fv_name="ip_src", pkt_offset="IP.src")
        vm.fix_chksum()
        return STLStream(
            name='S0',
            packet=STLPktBuilder(pkt=base_pkt/pad, vm=vm),
            mode=STLTXCont(pps=100),
            isg=0.0)

    def get_streams(self, tunables, **kwargs):
        parser = argparse.ArgumentParser(description='trexb generated profile',
                                         formatter_class=argparse.ArgumentDefaultsHelpFormatter)
        parser.add_argument('--size', type=int, default=64, help='frame size')
        args = parser.parse_args(tunables)
        return [self.create_stream_1(args)]


def register():
    return STLGenProfile()
```

Emission rules:
- One `create_stream_<n>` helper per enabled stream; `get_streams(self, tunables, **kwargs)` builds argparse from the tunables table (always emit the parser, even with zero tunables, to match TRex example conventions) and returns the list.
- TX modes: `STLTXCont(pps=)`, `STLTXSingleBurst(pps=, total_pkts=)`, `STLTXMultiBurst(pps=, pkts_per_burst=, ibg=, count=)`.
- Chaining: emit `name=`, `next='<name>'`, `self_start=False`, `action_count=` only when set.
- VM: high-level `STLVM()` style (`.var/.tuple_var/.write/.fix_chksum/.set_cached`) — not raw `STLScVmRaw`.
- Flow stats: `flow_stats=STLFlowStats(pg_id=N)` or `STLFlowLatencyStats(pg_id=N)`; when `addPortId`, change `get_streams` signature to `(self, port_id, tunables, **kwargs)` and emit `pg_id = N + port_id`.
- Omit kwargs that equal TRex defaults (isg 0, self_start True, etc.) except where needed for chaining clarity.
- Warnings to produce: frame size < 60; duplicate pg_id across latency streams; `next` referencing a missing/disabled stream; tuple + var writing to the same offset.

### Reference: real TRex v3.06 profiles the output must be idiomatic with

`udp_1pkt_simple.py` (minimal):
```python
class STLS1(object):
    def create_stream (self):
        return STLStream(packet=STLPktBuilder(pkt=Ether()/IP(src="16.0.0.1",dst="48.0.0.1")/UDP(dport=12,sport=1025)/(10*'x')), mode=STLTXCont())
    def get_streams (self, tunables, **kwargs):
        return [ self.create_stream() ]
def register():
    return STLS1()
```

`imix.py` (3 streams from a size/pps/isg table, STLVM with inc src+dst IP writes + fix_chksum). `multi_burst_2st_1000pkt.py` (chaining):
```python
STLProfile([ STLStream(isg=10.0, name='S0', packet=..., mode=STLTXSingleBurst(pps=10, total_pkts=1000), next='S1'),
             STLStream(self_start=False, name='S1', packet=..., mode=STLTXMultiBurst(pps=1000, pkts_per_burst=4, ibg=1000000.0, count=5)) ]).get_streams()
```
`flow_stats_latency.py`: `STLStream(..., mode=STLTXCont(pps=1000), flow_stats=STLFlowLatencyStats(pg_id=self.pg_id))` with `self.pg_id = args.pg_id + port_id`.

### tests.html (acceptance harness)

A standalone page loading the same scripts + fixture data. For each fixture: model JSON → `TB.gen.registry["3.06"].stl(model)` → string-diff against an embedded golden output; render green/red per test with a diff view on failure. Required fixtures: (1) minimal single cont UDP stream (≈`udp_1pkt_simple`), (2) 3-stream IMIX table with VM (≈`imix`), (3) chained single-burst→multi-burst (≈`multi_burst_2st_1000pkt`), (4) latency flow-stats stream with port_id-based pg_id (≈`flow_stats_latency`), (5) round-trip: model → JSON → parse → regenerate → identical output, (6) warning tests (short frame, duplicate latency pg_id).

### Acceptance checklist

- [ ] `index.html` opens from `file://` in Chrome and Firefox with zero console errors.
- [ ] Build a single-stream continuous UDP profile; output matches the minimal shape above; Copy and both Downloads work.
- [ ] Build the IMIX-style 3-stream profile with a VM variable; regenerates live on edit.
- [ ] Build a chained burst profile (S0 → S1, self_start false) and a latency stream with pg_id.
- [ ] Save profile, reload page, load profile — identical output. Workspace export/import round-trips.
- [ ] `tests.html` all green.
- [ ] Generated header contains the `stl-sim` validation command. (When you have a TRex box: `./stl-sim -f generated.py -o /tmp/out.pcap -l 50` exits 0.)

---
---

## PROMPT 1B — ASTF profile builder

Extend the existing "TRex Profile & Config Builder" static web app (vanilla JS, `TB` global namespace, classic scripts, no ES modules, no CDN — see the conventions already in the repo's `js/` files and keep them) with an **ASTF (advanced stateful) profile builder** tab generating TRex v3.06 ASTF Python profiles.

Follow the repo's established ground rules: pure generator `model → {files, warnings}` registered as `TB.gen.registry["3.06"].astf`; model carries `kind:"astf", schemaVersion:1, trexVersion:"3.06", meta`; generated header comment includes the validation command `# validate on the TRex box: ./astf-sim -f <name>.py --full -o /tmp/`; three output actions (Copy / Download .py / Download model JSON); localStorage save/load alongside STL profiles; live output pane.

### ASTF profile model

```json
{ "kind":"astf", "schemaVersion":1, "trexVersion":"3.06", "meta":{"name":"http_prog","description":"","modified":""},
  "ipGen": { "client":{"start":"16.0.0.1","end":"16.0.0.255","distribution":"seq","perCore":null},
             "server":{"start":"48.0.0.1","end":"48.0.255.255","distribution":"seq","perCore":null},
             "ipOffset":"1.0.0.0" },
  "globals": {
    "client": { "tcp": {"mss":null,"rxbufsize":null,"txbufsize":null,"initwnd":null,"no_delay":null,"do_rfc1323":null,"keepinit":null,"keepidle":null,"keepintvl":null},
                "scheduler": {"rampupSec":null},
                "ipv6": {"enable":false,"srcMsb":"","dstMsb":""} },
    "server": { "tcp": {"mss":null,"rxbufsize":null,"txbufsize":null,"initwnd":null,"no_delay":null,"do_rfc1323":null,"keepinit":null,"keepidle":null,"keepintvl":null},
                "scheduler": {"rampupSec":null},
                "ipv6": {"enable":false,"srcMsb":"","dstMsb":""} } },
  "mode":"program",
  "capList": [ {"file":"../avl/delay_10_http_browsing_0.pcap","cps":2.776,"port":null,"sDelayUsec":null,"ipGenOverride":null} ],
  "templates": [ { "id":"t1","tgName":null,"cps":1.0,"assocPort":80,
    "stream": true,
    "client": {"commands":[
        {"op":"send","payload":{"kind":"text","text":"GET / HTTP/1.1\r\nHost: x\r\n\r\n"}},
        {"op":"recv","bytes":32768} ]},
    "server": {"commands":[
        {"op":"recv","bytes":244},
        {"op":"send","payload":{"kind":"httpResponse","bodyBytes":32768}} ]},
    "ipGenOverride": null } ] }
```

`mode` ∈ `pcap | program` (capList used for pcap, templates for program). Command ops: `send(payload)`, `recv(bytes)`, `send_msg(payload)`, `recv_msg(count)` (the `_msg` forms are for UDP, i.e. `stream:false`), `delay(usec)`, `delay_rand(minUsec,maxUsec)`, `set_var(id,value)`, `set_label(name)`, `jmp_nz(id,label)`, `wait_for_peer_close()`. Payload kinds: `text` (emit as Python string literal with escapes), `httpRequest`/`httpResponse` snippet presets (generate realistic HTTP/1.1 request / response-with-body-of-N-bytes strings, matching TRex's http_manual_commands example).

### ASTF builder UI

Top bar: name, description, **mode switch pcap-list | program**.
- **ip_gen editor** (always visible): client range start/end + distribution (seq/rand) + optional per-core distribution; server range same; ip_offset (default `1.0.0.0`). Defaults exactly as in the model above (these match TRex's canonical `http_simple.py`).
- **Global info** (collapsible; two columns: Client / Server): the TCP fields, scheduler rampup_sec (client side is the one that matters — add a hint "linear CPS ramp to max over N sec"), IPv6 enable + src/dst MSB. Emit `ASTFGlobalInfo` only if at least one field is set on that side.
- **Pcap mode**: cap-list row editor — pcap path (text + datalist of common `avl/delay_10_*.pcap` names, prefix hint from settings pcapDir), cps, optional port pin, optional s_delay µs, optional per-cap ip_gen override (mini client/server range form).
- **Program mode**: template list (add/duplicate/delete) — each template: tg_name (optional), cps weight, association port, TCP/UDP toggle (`stream`), and two ordered **command editors** (Client program / Server program): add-command palette, drag-to-reorder, per-command inline fields. Validate: `jmp_nz` must reference an existing `set_var` id and `set_label`; `recv` bytes should normally equal the peer's send length (show soft hint with the computed peer send total).

### Codegen contract

Header comment, then `from trex.astf.api import *`, `import argparse`, `import os`, then a class with `get_profile(self, tunables, **kwargs)` (argparse stub always emitted, matching shipped examples) and module-level `register()`. Inside `get_profile`:

```python
# ip generator
ip_gen_c = ASTFIPGenDist(ip_range=["16.0.0.1", "16.0.0.255"], distribution="seq")
ip_gen_s = ASTFIPGenDist(ip_range=["48.0.0.1", "48.0.255.255"], distribution="seq")
ip_gen = ASTFIPGen(glob=ASTFIPGenGlobal(ip_offset="1.0.0.0"),
                   dist_client=ip_gen_c, dist_server=ip_gen_s)
```

Globals (only when set), field-by-field exactly like TRex's `param_sch_rampup.py` / `http_manual_tunables.py`:
```python
c_glob_info = ASTFGlobalInfo()
c_glob_info.scheduler.rampup_sec = 5
c_glob_info.tcp.mss = 1100
```

Pcap mode: `return ASTFProfile(default_ip_gen=ip_gen, default_c_glob_info=c_glob_info, cap_list=[ASTFCapInfo(file="...", cps=2.776), ASTFCapInfo(file="...", cps=404.52, port=8080)])` — omit `default_c_glob_info`/`default_s_glob_info` kwargs when unused, omit `port=`/`s_delay=` when null.

Program mode:
```python
prog_c = ASTFProgram()
prog_c.send(http_req)
prog_c.recv(len(http_response))

prog_s = ASTFProgram()
prog_s.recv(len(http_req))
prog_s.send(http_response)

temp_c = ASTFTCPClientTemplate(program=prog_c, ip_gen=ip_gen, port=80, cps=1)
temp_s = ASTFTCPServerTemplate(program=prog_s, assoc=ASTFAssociationRule(80))
template = ASTFTemplate(client_template=temp_c, server_template=temp_s)
return ASTFProfile(default_ip_gen=ip_gen, templates=[template])
```
- Payload strings become module-level or local variables (`http_req = b'...'`-style plain str as in TRex examples) so `len()` cross-references work; when the UI's recv bytes equals the peer send length, emit `prog_s.recv(len(http_req))` instead of the literal.
- UDP (`stream:false`): `ASTFProgram(stream=False)` and `send_msg`/`recv_msg`.
- Loops: `prog.set_var("var2", 10)`, `prog.set_label("a:")`, ..., `prog.jmp_nz("var2", "a:")` (exactly the `http_manual_commands_loop.py` idiom).
- Multi-template: emit `tg_name='...'` when set; distinct `ASTFAssociationRule(port)` per template (idiom from `template_groups.py`).
- Warnings: templates sharing an assoc port; jmp_nz to missing label/var; recv size mismatch vs peer send; rampup set on server side only.

### Reference: canonical TRex v3.06 ASTF profile (pcap mode) the output must be semantically equivalent to

`http_simple.py`:
```python
ip_gen_c = ASTFIPGenDist(ip_range=["16.0.0.0", "16.0.0.255"], distribution="seq")
ip_gen_s = ASTFIPGenDist(ip_range=["48.0.0.0", "48.0.255.255"], distribution="seq")
ip_gen = ASTFIPGen(glob=ASTFIPGenGlobal(ip_offset="1.0.0.0"),
                   dist_client=ip_gen_c, dist_server=ip_gen_s)
return ASTFProfile(default_ip_gen=ip_gen,
                   cap_list=[ASTFCapInfo(file="../avl/delay_10_http_browsing_0.pcap", cps=2.776)])
```

### Extend tests.html

Add ASTF golden fixtures: (1) pcap mode ≈ `http_simple` (cps 2.776, ranges above), (2) program mode HTTP ≈ `http_manual_commands`, (3) program loop with set_var/set_label/jmp_nz ≈ `http_manual_commands_loop`, (4) rampup profile with `scheduler.rampup_sec = 5` ≈ `param_sch_rampup`, (5) two templates with cps 1 and 2 on ports 80/81 with tg_names ≈ `template_groups`, (6) UDP `stream=False` program, (7) round-trip test, (8) warning tests.

### Acceptance checklist

- [ ] ASTF tab works from `file://`; both modes produce live output.
- [ ] Recreate all five reference shapes listed in the fixtures; `tests.html` all green (STL suite still green too).
- [ ] Global-info TCP fields and rampup emit only when set; ip_gen override per cap row works.
- [ ] Save/load ASTF models alongside STL models; workspace export includes both.
- [ ] Header contains the `astf-sim` validation command. (On a TRex box: `./astf-sim -f generated.py --full -o /tmp/` succeeds.)

---
---

## PROMPT 1C — Scenario wizards (two-server run + connection ramp)

Extend the existing "TRex Profile & Config Builder" static web app (vanilla JS, `TB` namespace, classic scripts, no ES modules — keep the repo's conventions) with a **Scenarios** tab containing two wizards. Each wizard is a short multi-step form that emits a multi-file bundle in the output pane — profile `.py` file(s), a `RUNBOOK.txt`, and the model JSON — and offers an **"Open in builder"** button that injects the generated model into the STL or ASTF builder tab for further editing (add a small hook to those builders to accept an injected model).

The wizards generate through the existing `TB.gen.registry["3.06"]` generators — they only construct models and runbook text.

### Wizard A — "Two servers: one sends, one receives"

Background (verified on TRex v3.06): TRex supports splitting the ASTF client and server roles across two chassis. Both boxes load the **same ASTF profile**. The receiver box runs the daemon with `--astf-server-only`; the sender box runs with `--astf-client-mask <hex bitmask of local ports>` (e.g. `0x1`). In the interactive console the equivalent start option is `start ... --client_mask`. Correct operation depends on the environment: the server box must own/answer the server-side IP range (via each box's `trex_cfg.yaml` `port_info` ip/default_gw or cross-wired MACs) and client/server ranges must be routable through the device under test.

Steps: (1) mode radio: **ASTF client/server split (recommended)** | STL unidirectional; (2) sender + receiver identifiers (free-text hostnames for now; note in code: later phases will offer the settings server registry here), client IP range, server IP range; (3) traffic: preset "HTTP-like program" (use the http_manual_commands request/response program shape) | pcap path + cps; target cps, duration, optional rampup_sec; (4) review + generate.

ASTF mode emits:
- `profile.py` — one ASTF profile (via the ASTF generator; program or pcap per choice; rampup in client globals if set).
- `RUNBOOK.txt` — exactly this structure:
  - Receiver box: `./t-rex-64 -i --astf --astf-server-only --cfg /etc/trex_cfg.yaml -c <cores>`
  - Sender box: `./t-rex-64 -i --astf --astf-client-mask 0x1 --cfg /etc/trex_cfg.yaml -c <cores>` then `./trex-console` → `start -f profile.py -m <mult> -d <duration>`
  - Pre-flight checklist: both boxes' trex_cfg.yaml port_info reviewed (server box answers the server ip_gen range; ip/default_gw or cross-wired dest_mac correct); ranges routable through the DUT; console `ping`/ARP resolution verified before start; what stats to watch on each side (client: active flows/cps/tx; server: rx, established).
- STL mode emits a TX-only STL profile for the sender (streams with dst = receiver-side range, optional latency stream with unique pg_id) plus a runbook: receiver runs `-i --stl` with no TX and measures via console stats/capture; clear note that cross-chassis flow-stat/latency correlation is not automatic.

### Wizard B — "Connection ramp: low → mid → high"

Steps: (1) engine radio: **ASTF (recommended)** | STL; (2) three stage targets (cps for ASTF / pps for STL) + per-stage duration; (3) mechanism radio with guidance text; (4) review + generate.

ASTF mechanisms:
1. **Linear rampup (`scheduler.rampup_sec`)** — one profile at the high target with `c_glob_info.scheduler.rampup_sec = <total ramp seconds>` (this is TRex's `param_sch_rampup.py` idiom: CPS increases linearly, reaching max after N sec). Best for smooth growth; note that there are no discrete plateaus.
2. **`-m` stepping runbook (default)** — profile whose base cps equals the LOW stage at `-m 1`; RUNBOOK.txt gives the console sequence: `start -f profile.py -m 1 -d <total>` → wait stage-1 seconds → `stop; start -f profile.py -m <mid/low> ...` → etc., with the honest caveat that each step restarts flows.
3. **Weighted multi-template mix** — three templates/cap entries with additive cps deltas (low, mid−low, high−mid) as a steady mix summing to the high rate; label clearly as an approximation preset.

STL mechanism — **additive staggered-isg continuous streams** (clean plateaus): S1 = cont @ low pps, isg 0; S2 = cont @ (mid−low) pps, isg = stage1 µs; S3 = cont @ (high−mid) pps, isg = (stage1+stage2) µs. Aggregate steps low→mid→high exactly. Runbook notes: `-m` scales all streams proportionally; latency streams ignore `-m`.

Both wizards: validate stage ordering (low < mid < high), positive durations; emit model JSON alongside; "Open in builder" round-trips.

### Acceptance checklist

- [ ] Both wizards work from `file://`; every path (ASTF/STL × mechanisms) produces profile + RUNBOOK.txt + model JSON.
- [ ] Runbook CLI lines match the flags above exactly (`--astf-server-only`, `--astf-client-mask 0x1`).
- [ ] "Open in builder" lands the model in the right tab, fully editable, regenerating identical output.
- [ ] STL staggered-isg profile: three streams whose pps values are the additive deltas and isg values the cumulative stage offsets.
- [ ] tests.html: add fixture tests for wizard model construction (given stage inputs → expected stream pps/isg set; given ramp choice 1 → rampup_sec emitted).

---
---

## PROMPT 2 — Settings menu + trex_cfg.yaml builder

Extend the existing "TRex Profile & Config Builder" static web app (vanilla JS, `TB` namespace, classic scripts, no ES modules — keep repo conventions) with (a) a **Settings** UI over the existing `TB.settings` schema and (b) a **Platform Config** tab generating `trex_cfg.yaml` files, registered as `TB.gen.registry["3.06"].cfg`.

### Settings model (extend `trexb.settings.v1`)

```json
{ "schemaVersion": 1,
  "defaults": { "trexVersion":"3.06", "pcapDir": "/opt/trex/v3.06/avl", "activeServerId": "srv1" },
  "servers": [ { "id":"srv1", "name":"trex-a", "mgmtHost":"10.0.0.11", "trexDir":"/opt/trex/v3.06",
      "cores": 4, "portLimit": 2, "portBandwidthGb": 10,
      "interfaces": ["03:00.0","03:00.1"],
      "ports": [ { "mode":"ip", "srcMac":"", "destMac":"", "ip":"1.1.1.1", "defaultGw":"2.2.2.2" },
                 { "mode":"ip", "srcMac":"", "destMac":"", "ip":"2.2.2.2", "defaultGw":"1.1.1.1" } ],
      "platform": { "enabled": false, "masterThreadId": 0, "latencyThreadId": 5,
                    "dualIf": [ { "socket": 0, "threads": [1,2,3,4,6,7] } ] },
      "memory": { "enabled": false, "dpFlows": null },
      "limitMemory": null, "prefix": null, "enableZmqPub": null, "telnetPort": null } ] }
```

### Settings UI

Gear icon in the header → settings panel: defaults (target TRex version, pcap dir) + **server registry**: list of servers (add/duplicate/delete), per-server form mirroring the model — name, mgmt host, TRex dir, cores, port limit, port bandwidth, interfaces (list of PCI addresses with format validation `hh:hh.h` or `hhhh:hh:hh.h`; hint: "find with ./dpdk_setup_ports.py -s"), per-port mode radio **MAC | IP** (MAC: src/dest MAC fields; IP: ip/default_gw), optional platform block (master/latency thread ids, dual_if rows of socket + thread list), optional memory/limit_memory/prefix/zmq/telnet. Workspace Export/Import buttons live here too.

### Platform Config tab

Pick a server from the registry → live YAML preview → the standard three output actions. Suggested filename `trex_cfg_<servername>.yaml`.

### Codegen contract — CRITICAL FORMAT RULE

`trex_cfg.yaml` is a **single-element YAML list**: the first key line starts with `- ` and every other top-level key aligns under it. Omitting the leading dash makes TRex reject the file. Emit only set fields. Reference shapes from the real v3.06 distribution:

`simple_cfg.yaml` (IP mode):
```yaml
- port_limit      : 2
  version         : 2
  interfaces    : ["03:00.0","03:00.1"]
  port_info       :
          - ip         : 1.1.1.1
            default_gw : 2.2.2.2
          - ip         : 2.2.2.2
            default_gw : 1.1.1.1
```

`xl710.yaml` (MAC mode + platform):
```yaml
- version         : 2
  interfaces      : ["08:00.0","08:00.1"]
  port_limit      : 2
  c               : 4
  port_bandwidth_gb : 40
  platform :
        master_thread_id  : 0
        latency_thread_id : 5
        dual_if   :
             - socket   : 0
               threads  : [1,2,3,4,6,7]
  port_info       :
          - dest_mac        :   [0x00,0x0c,0x29,0x55,0x37,0xc7]  # port 0
            src_mac         :   [0x00,0x0c,0x29,0x55,0x37,0xbd]
          - dest_mac        :   [0x00,0x0c,0x29,0x55,0x37,0xbd]  # port 1
            src_mac         :   [0x00,0x0c,0x29,0x55,0x37,0xc7]
```

MAC addresses are emitted as byte arrays `[0x00,0x0c,...]` converted from the `aa:bb:cc:dd:ee:ff` the UI collects. `memory: { dp_flows: N }`, `limit_memory`, `prefix`, `enable_zmq_pub`, `telnet_port` emitted only when set (shapes as in the distribution's `x710_advance_more_flows.yaml` / `trex_advanced_cfg-10g.yaml`).

Warnings: master/latency thread id colliding with dual_if threads; `c` exceeding total dual_if threads; ports mixing MAC and IP mode inconsistently within a pair; interface count ≠ port_limit; typical convention is cross-wired dest/src MACs between paired ports (info hint when not cross-wired).

### Acceptance checklist

- [ ] Settings persist in localStorage; workspace export/import round-trips servers + defaults + profiles.
- [ ] Generated YAML for an IP-mode server matches the `simple_cfg.yaml` shape; MAC+platform server matches the `xl710.yaml` shape; 2-socket + memory case matches `x710_advance_more_flows.yaml` structure (two dual_if entries + `memory: dp_flows`).
- [ ] **Leading `- ` present** — tests.html includes a structural test asserting the first line starts with `- ` and the document parses as a 1-element list (write a minimal structural check, not a full YAML parser).
- [ ] All warnings above trigger correctly. Everything still works from `file://`.

---
---

## PROMPT 3 — CLI command builder

Extend the existing "TRex Profile & Config Builder" static web app (vanilla JS, `TB` namespace, classic scripts, no ES modules — keep repo conventions) with a **CLI Builder** tab that composes `t-rex-64` command lines and matching `trex-console` commands, registered as `TB.gen.registry["3.06"].cli`.

### UI

- **Server** dropdown (from the settings registry) — prefills cores and suggests `--cfg /etc/trex_cfg.yaml` (editable custom path).
- **Mode radio:** Interactive STL (`-i --stl`) | Interactive ASTF (`-i --astf`) | Legacy/batch STF (`-f <yaml>` + `-d`).
- Common flags: `-c <cores>` (default from server), `-m <multiplier>`, `-d <duration sec>`, `-l <latency pps>`, `-p` (flow-port affinity), `--cfg <path>`.
- ASTF extras (visible only in ASTF mode): `--astf-server-only` (checkbox: "this box is the receive/server side"), `--astf-client-mask <hex>` (text with 0x validation; hint: bitmask of local ports acting as client). These flags exist in the v3.06 binary. Mutually exclusive — selecting one disables the other.
- Profile picker: dropdown of saved STL/ASTF profiles from localStorage (uses `-f <name>.py` in legacy/console contexts) or free-text path.
- Free-form "extra args" field appended verbatim.
- Output: (1) the one-line `./t-rex-64 ...` command; (2) when interactive, a matching `trex-console` block: `./trex-console` then `start -f <profile.py> -m <mult> -d <dur>` (ASTF) or `start -f <profile.py> -m <mult> -p 0` style (STL), including `--client_mask <hex>` on the ASTF start line when a client mask is set (the interactive API supports client_mask on start). Standard three output actions (artifact download as `run_<name>.sh` with shebang).

### Rules

- Flags render only when valid for the selected mode (e.g. `--astf-server-only` hidden in STL mode; `-f` on the t-rex-64 line only in legacy mode — interactive modes load profiles via the console).
- Command assembles in canonical order: `./t-rex-64 -i --astf --cfg <path> -c <n> [astf extras] [extra args]`.
- Warnings: multiplier with `--astf-server-only` (server side doesn't generate load); `-l` latency with a note that STL latency streams ignore `-m`; missing cfg path.

### Acceptance checklist

- [ ] Each mode produces a correct single-line command; flags appear/disappear per mode; copy works.
- [ ] ASTF server-only vs client-mask mutual exclusion enforced.
- [ ] Console block matches the two-server runbook lines produced by the Scenario wizard (same flag spellings).
- [ ] tests.html: table-driven tests mapping CLI model fixtures → expected command strings, all green. Works from `file://`.

---
---

## PROMPT 4 — cap2 YAML builder (legacy pcap-replay profiles)

Extend the existing "TRex Profile & Config Builder" static web app (vanilla JS, `TB` namespace, classic scripts, no ES modules — keep repo conventions) with a **cap2 Builder** tab generating TRex legacy stateful (STF) YAML profiles, registered as `TB.gen.registry["3.06"].cap2`. These profiles replay pcap templates with IP rewriting and are run with `t-rex-64 -f <profile.yaml> -d <dur>`.

### Model

```json
{ "kind":"cap2", "schemaVersion":1, "trexVersion":"3.06", "meta":{"name":"my_stf"},
  "duration": 10.0,
  "generator": { "distribution":"seq", "clientsStart":"16.0.0.1","clientsEnd":"16.0.1.255",
                 "serversStart":"48.0.0.1","serversEnd":"48.0.0.255",
                 "clientsPerGb":201,"minClients":101,"dualPortMask":"1.0.0.0",
                 "tcpAging":1,"udpAging":1 },
  "flags": { "capIpg": null, "capOverrideIpg": null, "capIpgMin": null,
             "vlan": {"enabled":false,"vlan0":100,"vlan1":200}, "macOverrideByIp": null },
  "capInfo": [ { "name":"cap2/dns.pcap","cps":1.0,"ipg":10000,"rtt":10000,"w":1,
                 "limit":null,"plugin_id":null,
                 "dynPyload": [ {"pktId":1,"pyldOffset":16,"type":0,"len":4,"mask":"0xffffffff"} ] } ] }
```

### UI

Sections: duration; generator block (all fields above); global flags (cap_ipg checkbox — "use pcap's real inter-packet gaps", cap_override_ipg, cap_ipg_min, vlan enable + vlan0/vlan1, mac_override_by_ip); **cap_info list editor** — rows with pcap path (datalist of common `cap2/` and `avl/` pcaps), cps, ipg µs, rtt µs, w, optional limit (max active flows), optional plugin_id (select: none | 4 = HTTP | 5 = DHCP), optional **dyn_pyload sub-editor** (rows: pkt_id, pyld_offset, type 0=random|1=client_ip, len in uint32s, mask hex) for payload manipulation.

### Codegen — CRITICAL FORMAT RULE

Like trex_cfg.yaml, cap2 profiles are a **single-element YAML list** (leading `- ` mandatory). Reference shape from the real v3.06 distribution, `cap2/dns.yaml`:

```yaml
- duration : 10.0
  generator :
          distribution : "seq"
          clients_start : "16.0.0.1"
          clients_end   : "16.0.1.255"
          servers_start : "48.0.0.1"
          servers_end   : "48.0.0.255"
          clients_per_gb : 201
          min_clients    : 101
          dual_port_mask : "1.0.0.0"
          tcp_aging      : 1
          udp_aging      : 1
  cap_info :
     - name: cap2/dns.pcap
       cps : 1.0
       ipg : 10000
       rtt : 10000
       w   : 1
```

`dyn_pyload` emits per cap_info entry as a list of `{pkt_id, pyld_offset, type, len, mask}` maps (shape as in the distribution's `cap2/dyn_pyld1.yaml`); global flags emit at top level only when set (`cap_ipg : true`, `vlan : { enable : 1, vlan0 : 100, vlan1 : 200 }`, `mac_override_by_ip : 2`).

Header comment: `# run: ./t-rex-64 -f <name>.yaml -d <duration> --cfg /etc/trex_cfg.yaml` (as YAML comments).

Warnings: cps ≤ 0; overlapping client/server ranges; dyn_pyload offset beyond typical payload; plugin_id with a non-matching pcap name (soft hint only).

### Acceptance checklist

- [ ] Reproduce `dns.yaml` byte-similar from a fixture model; reproduce a `dyn_pyld1.yaml`-shaped profile with a dyn_pyload block.
- [ ] Leading `- ` structural test in tests.html; all suites green; `file://` still clean.

---
---

## PROMPT 5 — Flask wrapper + validation API (future / optional)

Wrap the existing "TRex Profile & Config Builder" static web app in a minimal Flask server intended to run **on the TRex box itself**, adding server-side conveniences the static app cannot provide. The static app must keep working unchanged without Flask — the frontend feature-detects the backend.

### Backend (`app.py`, Python 3, Flask only — no other deps)

- Serve the repo root as static: `Flask(__name__, static_folder='.', static_url_path='')`, `/` → `index.html`.
- `GET /api/ping` → `{ "ok": true, "version": "1", "trexDir": "<configured>" }`.
- `GET /api/pcaps?dir=<subdir>` → JSON list of `.pcap`/`.cap` files under a configured TRex directory (path-traversal-safe: resolve and verify the path stays under the configured root).
- `POST /api/validate` — body `{ "kind": "stl"|"astf", "content": "<profile.py text>" }`: write to a temp file, run the TRex simulator (`<trexDir>/stl-sim -f <tmp> -o /tmp/trexb_val.pcap -l 50` or `<trexDir>/astf-sim -f <tmp> --full -o /tmp/`), return `{ exitCode, stdout, stderr }` with a timeout (e.g. 30 s). Never execute anything other than these two fixed simulator commands.
- Config via env vars or a small `config.py`: `TREX_DIR` (default `/opt/trex/v3.06`), listen host/port.

### Frontend

- `TB.backend`: on boot, `fetch('/api/ping')` with a short timeout; on success set `TB.backend.available = true` and reveal backend features; on failure (including `file://` where fetch throws) everything stays hidden — zero console noise.
- When available: pcap path fields gain a "Browse…" button (modal listing `/api/pcaps` results); STL/ASTF output panes gain a "Validate on server" button showing the sim's stdout/stderr and exit status inline.

### Acceptance checklist

- [ ] `python app.py` on a box with TRex at `TREX_DIR` serves the app; browse and validate work end-to-end.
- [ ] Opening `index.html` from `file://` (no Flask) behaves exactly as before — no errors, backend features hidden.
- [ ] Path traversal attempts on `/api/pcaps` are rejected; `/api/validate` refuses kinds other than stl/astf and times out runaway sims.

---
---

## After all phases

- Run the full `tests.html` suite (all phases' fixtures) in Chrome + Firefox from `file://`.
- On a TRex v3.06 box: validate a generated STL profile with `stl-sim`, an ASTF profile with `astf-sim`, start `t-rex-64` with a generated `trex_cfg.yaml`, and walk both scenario runbooks (two-server, ramp) end to end.
- Faithfulness check: a generated http_simple-equivalent ASTF profile should be semantically identical to `v3.06/astf/http_simple.py` (same ip_gen values, cps, cap file), formatting aside.
- To add TRex 3.07/3.08 support later: register `TB.gen.registry["3.07"]` delegating to the 3.06 generators with a delta/quirk table, add per-version golden fixtures, and add the option to the version selector — no UI or model rewrites.
