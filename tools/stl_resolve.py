"""TRex Profile & Config Builder - STL .py profile resolver (execute-not-parse).

Loads a stateless profile the way TRex itself does - by running it - and emits
an editable builder model (JSON on stdout). Where the offline JS parser can only
read the shapes the tool emits, this executes the profile's real Python (list
comprehensions, __init__ tables, conditionals, imperative field engines) and
captures the concrete streams that result.

Portability trick: rather than requiring the full TRex client library (which
pulls in networking code that will not import off a TRex box), we inject
lightweight *recording* stand-ins for the stream-building classes
(STLStream / STLPktBuilder / STLVM / STLTX* / STLProfile / STLVm*...) as the
`trex_stl_lib` package, and let the profile build its packets with the real,
locally-installed scapy. The profile runs unmodified; we read the objects it
produced. Only scapy is required.

This executes arbitrary Python, so callers MUST run it sandboxed - the Flask
endpoint runs it in a subprocess with a timeout, the same trust model as the
existing stl-sim /api/validate path.

Usage:
    python tools/stl_resolve.py <profile.py>
Prints a builder model as JSON, or {"ok": false, "error": ...} on failure.
"""
import sys
import os
import json
import types
import inspect
import runpy

# stdout must carry ONLY the final JSON (the Flask endpoint captures it), but
# scapy prints a WinPcap warning at import and profiles may print() freely -
# send all of that to stderr and keep the real stdout for the result alone.
_REAL_STDOUT = sys.stdout
sys.stdout = sys.stderr


def _emit(d):
    _REAL_STDOUT.write(json.dumps(d) + "\n")
    _REAL_STDOUT.flush()


# --- real scapy (for building/rendering the packets the profile constructs) ---
try:
    from scapy.all import Packet  # noqa: F401
    import scapy.all as scapy_all
except Exception as exc:  # pragma: no cover
    _emit({"ok": False, "error": "scapy is required: %s" % exc})
    sys.exit(0)


# --- recording stand-ins for the TRex stream-building API --------------------
class _Rec(object):
    """Base recorder: keeps the kwargs (and positional args) it was built with."""
    def __init__(self, *args, **kw):
        self._args = args
        self._kw = kw


class STLStream(_Rec):
    pass


class STLPktBuilder(_Rec):
    def __init__(self, pkt=None, vm=None, **kw):
        _Rec.__init__(self, pkt=pkt, vm=vm, **kw)
        self.pkt = pkt
        self.vm = vm


class _Mode(_Rec):
    kind = "cont"


class STLTXCont(_Mode):
    kind = "cont"


class STLTXSingleBurst(_Mode):
    kind = "single_burst"


class STLTXMultiBurst(_Mode):
    kind = "multi_burst"


class STLFlowStats(_Rec):
    latency = False


class STLFlowLatencyStats(_Rec):
    latency = True


class STLVM(object):
    """Fluent field engine - record each call in order."""
    def __init__(self, *a, **k):
        self.ops = []

    def var(self, **kw):
        self.ops.append(("var", kw))

    def tuple_var(self, **kw):
        self.ops.append(("tuple", kw))

    def write(self, **kw):
        self.ops.append(("write", kw))

    def write_mask(self, **kw):
        self.ops.append(("write_mask", kw))

    def fix_chksum(self, **kw):
        self.ops.append(("fix", kw))

    def fix_chksum_hw(self, **kw):
        self.ops.append(("fix", kw))

    def trim(self, *a, **k):
        pass

    def set_cached(self, size=None, *a, **k):
        self.ops.append(("cache", {"size": size}))

    def repeatable_random_var(self, **kw):
        self.ops.append(("var", kw))


class STLScVmRaw(object):
    """Low-level field engine: a list of STLVm* command objects."""
    def __init__(self, cmds=None, **kw):
        self.cmds = cmds or []


class _VmCmd(_Rec):
    tag = ""


class STLVmFlowVar(_VmCmd):
    tag = "var"


class STLVmFlowVarRepeatableRandom(_VmCmd):
    tag = "var"


class STLVmWrFlowVar(_VmCmd):
    tag = "write"


class STLVmWrMaskFlowVar(_VmCmd):
    tag = "write_mask"


class STLVmFixIpv4(_VmCmd):
    tag = "fix"


class STLVmFixChecksumHw(_VmCmd):
    tag = "fix"


class STLVmTupleGen(_VmCmd):
    tag = "tuple"


class STLVmTrimPktSize(_VmCmd):
    tag = "trim"


class _PcapProfile(object):
    def __init__(self, path, kw):
        self.path = path
        self.kw = kw

    def get_streams(self, *a, **k):
        # pcap replay is represented on the model, not as concrete streams
        return _PCAP_MARKER(self.path, self.kw)


class _PCAP_MARKER(object):
    def __init__(self, path, kw):
        self.path = path
        self.kw = kw


class STLProfile(object):
    """Container: keeps its stream list; get_streams() hands it back."""
    def __init__(self, streams=None, *a, **k):
        if streams is None:
            streams = []
        self.streams = streams if isinstance(streams, (list, tuple)) else [streams]

    def get_streams(self, *a, **k):
        return list(self.streams)

    @staticmethod
    def load_pcap(path, **kw):
        return _PcapProfile(path, kw)


# Permissive stand-in for any TRex class we don't model explicitly: instances
# record their args, and arbitrary CLASS attributes (e.g. CTRexVmInsFixHwCs.
# L4_TYPE_UDP) resolve to a dummy so profiles that reference them still run.
class _AnyMeta(type):
    def __getattr__(cls, name):
        return 0


def _generic(name):
    return _AnyMeta(str(name), (_Rec,), {})


# names the recording API exposes (everything a profile might import)
_API = {
    "STLStream": STLStream, "STLPktBuilder": STLPktBuilder, "STLProfile": STLProfile,
    "STLTXCont": STLTXCont, "STLTXSingleBurst": STLTXSingleBurst, "STLTXMultiBurst": STLTXMultiBurst,
    "STLFlowStats": STLFlowStats, "STLFlowLatencyStats": STLFlowLatencyStats,
    "STLVM": STLVM, "STLScVmRaw": STLScVmRaw,
    "STLVmFlowVar": STLVmFlowVar, "STLVmFlowVarRepeatableRandom": STLVmFlowVarRepeatableRandom,
    "STLVmWrFlowVar": STLVmWrFlowVar, "STLVmWrMaskFlowVar": STLVmWrMaskFlowVar,
    "STLVmFixIpv4": STLVmFixIpv4, "STLVmFixChecksumHw": STLVmFixChecksumHw,
    "STLVmTupleGen": STLVmTupleGen, "STLVmTrimPktSize": STLVmTrimPktSize,
    "STLError": type("STLError", (Exception,), {}),
    # referenced by some profiles but not modelled - generic recorders so the
    # profile runs; their exotic behaviour is simply not captured (best-effort).
    "CTRexVmInsFixHwCs": _generic("CTRexVmInsFixHwCs"),
    "STLHltStream": _generic("STLHltStream"),
}


def _install_fake_trex():
    """Register a fake `trex_stl_lib` whose api re-exports our recorders + scapy."""
    api = types.ModuleType("trex_stl_lib.api")
    for name, obj in _API.items():
        setattr(api, name, obj)
    # re-export the real scapy names so `from trex_stl_lib.api import *` gives
    # Ether/IP/UDP/... that build genuine packets we can render.
    for name in dir(scapy_all):
        if not name.startswith("_") and not hasattr(api, name):
            setattr(api, name, getattr(scapy_all, name))
    api.__all__ = [n for n in dir(api) if not n.startswith("_")]

    # catch-all: any still-unknown name accessed on the api (e.g. a rare class
    # imported by name) resolves to a generic recorder, cached for reuse.
    def _api_getattr(name):
        obj = _generic(name)
        setattr(api, name, obj)
        return obj
    api.__getattr__ = _api_getattr

    # register the package + every namespace shipped profiles import from. They
    # all point at the same api module, which resolves any class by name.
    pkg = types.ModuleType("trex_stl_lib")
    pkg.api = api
    pkg.__path__ = []
    sys.modules["trex_stl_lib"] = pkg
    sys.modules["trex_stl_lib.api"] = api
    trex = types.ModuleType("trex"); trex.__path__ = []
    stl = types.ModuleType("trex.stl"); stl.__path__ = []
    trex.stl = stl
    sys.modules["trex"] = trex
    sys.modules["trex.stl"] = stl
    for alias in ("trex.stl.api", "trex.stl.trex_stl_streams",
                  "trex.stl.trex_stl_packet_builder_scapy", "trex.stl.trex_stl_hltapi",
                  "trex_stl_lib.trex_stl_hltapi"):
        sys.modules[alias] = api


# --- model construction ------------------------------------------------------
def _new_stream(name):
    return {
        "id": "s_%s" % name, "name": name, "enabled": True,
        "packet": {
            "l2": {"srcMac": None, "dstMac": None},
            "vlan": {"enabled": False, "id": 100, "prio": 0},
            "l3": {"type": "ipv4", "src": "16.0.0.1", "dst": "48.0.0.1", "tos": None,
                   "ttl": None, "fragOffset": None, "moreFrags": False, "ext": "none"},
            "l4": {"type": "udp", "sport": 1025, "dport": 12, "tcpFlags": None,
                   "icmpKind": "echo-request", "icmpId": None, "icmpSeq": None},
            "tunnel": {"type": "none", "outerSrc": "10.0.0.1", "outerDst": "10.0.0.2",
                       "vni": 5000, "label": 100, "mplsTtl": None, "outerVlanId": 100,
                       "spi": 42, "si": 1},
            "payload": {"mode": "pad", "frameSize": 64, "frameSizeTunable": None,
                        "fill": "x", "rawScapy": None},
        },
        "mode": {"type": "cont", "rateUnit": "pps", "pps": 100, "totalPkts": 1000,
                 "pktsPerBurst": 4, "ibgUsec": 1000000, "count": 5},
        "isgUsec": 0,
        "chain": {"selfStart": True, "next": None, "actionCount": None},
        "vm": {"cacheSize": None, "vars": [], "tuple": None},
        "flowStats": {"type": "none", "pgId": None, "addPortId": False},
    }


_RATE_KEYS = ["pps", "bps_L1", "bps_L2", "percentage"]


def _apply_mode(mode_obj, m):
    if not isinstance(mode_obj, _Mode):
        return
    m["type"] = mode_obj.kind
    kw = mode_obj._kw
    for k in _RATE_KEYS:
        if k in kw:
            m["rateUnit"] = k
            m["pps"] = kw[k]
            break
    if "total_pkts" in kw:
        m["totalPkts"] = kw["total_pkts"]
    if "pkts_per_burst" in kw:
        m["pktsPerBurst"] = kw["pkts_per_burst"]
    if "ibg" in kw:
        m["ibgUsec"] = kw["ibg"]
    if "count" in kw:
        m["count"] = kw["count"]


def _vm_ops(vm_obj):
    """Normalise a fluent STLVM or a low-level STLScVmRaw into a list of
    (tag, kwargs) tuples, in order."""
    if isinstance(vm_obj, STLVM):
        return vm_obj.ops
    if isinstance(vm_obj, STLScVmRaw):
        out = []
        for cmd in vm_obj.cmds:
            if isinstance(cmd, _VmCmd) and cmd.tag:
                out.append((cmd.tag, cmd._kw))
        return out
    return []


def _apply_vm(vm_obj, vm):
    ops = _vm_ops(vm_obj)
    if not ops:
        return
    writes = {}
    tuple_kw = None
    has_fix = False
    for tag, kw in ops:
        if tag == "write":
            fv = kw.get("fv_name")
            if fv is not None:
                writes[fv] = kw
        elif tag == "tuple":
            tuple_kw = kw
        elif tag == "fix":
            has_fix = True
    for tag, kw in ops:
        if tag == "var":
            nm = kw.get("name")
            w = writes.get(nm, {})
            vm["vars"].append({
                "name": nm, "sizeBytes": kw.get("size", 4), "op": kw.get("op", "inc"),
                "min": kw.get("min_value"), "max": kw.get("max_value"),
                "step": kw.get("step", 1), "nextVar": kw.get("next_var"),
                "splitToCores": kw.get("split_to_cores", True),
                "writeTo": w.get("pkt_offset", "IP.src"),
                "offsetFixup": w.get("offset_fixup"),
                "fixChecksum": has_fix and tuple_kw is None,
            })
        elif tag == "cache":
            vm["cacheSize"] = kw.get("size")
    if tuple_kw is not None:
        tname = tuple_kw.get("name", "tuple")
        ip_w = writes.get(tname + ".ip", {})
        port_w = writes.get(tname + ".port", {})
        vm["tuple"] = {
            "name": tname, "ipMin": tuple_kw.get("ip_min", ""), "ipMax": tuple_kw.get("ip_max", ""),
            "portMin": tuple_kw.get("port_min"), "portMax": tuple_kw.get("port_max"),
            "limitFlows": tuple_kw.get("limit_flows"),
            "writeIpTo": ip_w.get("pkt_offset", "IP.src"),
            "writePortTo": port_w.get("pkt_offset", "UDP.sport"),
        }


def _stream_to_model(stream, idx):
    kw = stream._kw
    name = kw.get("name") or "S%d" % idx
    s = _new_stream(str(name))
    pb = kw.get("packet")
    if isinstance(pb, STLPktBuilder):
        pkt = pb.pkt
        if isinstance(pkt, Packet):
            try:
                s["packet"]["payload"]["rawScapy"] = pkt.command()
            except Exception:
                s["packet"]["payload"]["rawScapy"] = repr(pkt)
        elif pkt is not None:
            s["packet"]["payload"]["rawScapy"] = str(pkt)
        if pb.vm is not None:
            _apply_vm(pb.vm, s["vm"])
    _apply_mode(kw.get("mode"), s["mode"])
    if kw.get("isg"):
        s["isgUsec"] = kw["isg"]
    fs = kw.get("flow_stats")
    if isinstance(fs, (STLFlowStats, STLFlowLatencyStats)):
        s["flowStats"]["type"] = "latency" if fs.latency else "stats"
        pg = fs._kw.get("pg_id")
        if isinstance(pg, int):
            s["flowStats"]["pgId"] = pg
    if kw.get("next"):
        s["chain"]["next"] = kw["next"]
    if kw.get("self_start") is False:
        s["chain"]["selfStart"] = False
    if isinstance(kw.get("action_count"), int):
        s["chain"]["actionCount"] = kw["action_count"]
    return s


def _call_get_streams(obj):
    """Call get_streams with a best-effort set of args (tunables/direction/
    port_id), trying the widest signature the object declares."""
    fn = getattr(obj, "get_streams", None)
    if fn is None:
        raise RuntimeError("register() object has no get_streams()")
    try:
        params = [p for p in inspect.signature(fn).parameters.values()]
    except (TypeError, ValueError):
        params = []
    supply = {"tunables": [], "direction": 0, "port_id": 0, "kwargs": {}}
    call_kw = {}
    for p in params:
        if p.name in supply and p.kind in (p.POSITIONAL_OR_KEYWORD, p.KEYWORD_ONLY):
            call_kw[p.name] = supply[p.name]
    try:
        return fn(**call_kw)
    except TypeError:
        for attempt in ([], [[]], [0, []]):
            try:
                return fn(*attempt)
            except TypeError:
                continue
        raise


def resolve(path):
    _install_fake_trex()
    prof_dir = os.path.dirname(os.path.abspath(path))
    if prof_dir not in sys.path:
        sys.path.insert(0, prof_dir)
    ns = runpy.run_path(path)
    register = ns.get("register")
    if not callable(register):
        return {"ok": False, "error": "profile has no register() function"}
    obj = register()
    streams = _call_get_streams(obj)

    model = {
        "kind": "stl", "schemaVersion": 1, "trexVersion": "3.06",
        "meta": {"name": os.path.splitext(os.path.basename(path))[0], "description": "", "modified": ""},
        "tunables": [],
        "pcapReplay": {"enabled": False, "file": "cap2/dns.pcap", "ipgUsec": 10, "loopCount": 5, "speedup": 1},
        "streams": [],
    }

    if isinstance(streams, _PCAP_MARKER):
        kw = streams.kw
        model["pcapReplay"] = {
            "enabled": True, "file": streams.path,
            "ipgUsec": kw.get("ipg_usec", 10), "loopCount": kw.get("loop_count", 5),
            "speedup": kw.get("speedup", 1),
        }
        return {"ok": True, "engine": "python-exec", "resolved": 0, "model": model}

    if not isinstance(streams, (list, tuple)):
        streams = [streams]
    idx = 0
    raw_pkts = 0
    for st in streams:
        if not isinstance(st, STLStream):
            continue
        sm = _stream_to_model(st, idx)
        if sm["packet"]["payload"]["rawScapy"]:
            raw_pkts += 1
        model["streams"].append(sm)
        idx += 1
    if not model["streams"]:
        return {"ok": False, "error": "no STLStream objects were produced"}
    return {"ok": True, "engine": "python-exec", "resolved": len(model["streams"]),
            "rawPackets": raw_pkts, "model": model}


def main():
    if len(sys.argv) < 2:
        _emit({"ok": False, "error": "usage: stl_resolve.py <profile.py>"})
        return
    try:
        _emit(resolve(sys.argv[1]))
    except Exception as exc:  # noqa: BLE001 - report any resolution failure as data
        import traceback
        _emit({"ok": False, "error": "%s: %s" % (type(exc).__name__, exc),
               "trace": traceback.format_exc()[-1500:]})


if __name__ == "__main__":
    main()
