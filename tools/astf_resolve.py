"""TRex Profile & Config Builder - ASTF .py profile resolver (execute-not-parse).

The ASTF counterpart of tools/stl_resolve.py. It loads a stateful profile the
way TRex does - by running its get_profile() - and emits an editable builder
model (JSON on stdout). Where the offline parser can't follow argparse tunables,
conditionals or loops, this executes them and reads the concrete ASTFProfile the
code produced.

Portability trick (same as the STL resolver): rather than importing the real
trex.astf library (which pulls in networking code that won't load off a TRex
box), we inject lightweight *recording* stand-ins for the ASTF classes
(ASTFProfile / ASTFTemplate / ASTFProgram / ASTFCapInfo / ASTFIPGen* /
ASTFTCPClient+ServerTemplate / ASTFGlobalInfo / ASTFAssociationRule ...) as the
trex.astf.api module, and let the profile run against them. Only scapy is needed
(for the `import *` surface and `os`).

Executes arbitrary Python - callers MUST sandbox it. The Flask endpoint runs it
in a subprocess with a timeout, the same trust model as /api/validate.

Usage:  python tools/astf_resolve.py <profile.py>
"""
import sys
import os
import json
import types
import inspect
import runpy

# stdout must carry ONLY the final JSON (the endpoint captures it); scapy prints
# a WinPcap warning at import and profiles may print - send all that to stderr.
_REAL_STDOUT = sys.stdout
sys.stdout = sys.stderr


def _emit(d):
    _REAL_STDOUT.write(json.dumps(d) + "\n")
    _REAL_STDOUT.flush()


try:
    import scapy.all as scapy_all
except Exception as exc:  # pragma: no cover
    _emit({"ok": False, "error": "scapy is required: %s" % exc})
    sys.exit(0)


# --- recording stand-ins for the ASTF API -----------------------------------
class _Rec(object):
    def __init__(self, *args, **kw):
        self._args = args
        self._kw = kw


class _Ns(object):
    """Bare namespace: records arbitrary attribute assignments (c_glob_info.tcp.mss = ...)."""


class ASTFIPGenDist(_Rec):
    pass


class ASTFIPGenGlobal(_Rec):
    pass


class ASTFIPGen(_Rec):
    pass


class ASTFGlobalInfo(object):
    def __init__(self, *a, **k):
        self.tcp = _Ns()
        self.ip = _Ns()
        self.scheduler = _Ns()
        self.ipv6 = _Ns()


class ASTFCapInfo(_Rec):
    pass


class ASTFAssociationRule(_Rec):
    pass


class ASTFProgram(object):
    _CORE = ('send', 'recv', 'send_msg', 'recv_msg', 'delay', 'delay_rand',
             'set_var', 'set_label', 'jmp_nz', 'wait_for_peer_close')

    def __init__(self, *a, **k):
        self.stream = k.get('stream', True)
        self.cmds = []

    def send(self, buf=None, *a, **k):
        self.cmds.append(('send', buf))

    def send_msg(self, buf=None, *a, **k):
        self.cmds.append(('send_msg', buf))

    def recv(self, n=None, *a, **k):
        self.cmds.append(('recv', n))

    def recv_msg(self, n=None, *a, **k):
        self.cmds.append(('recv_msg', n))

    def delay(self, usec=None, *a, **k):
        self.cmds.append(('delay', usec))

    def delay_rand(self, mn=None, mx=None, *a, **k):
        self.cmds.append(('delay_rand', (mn, mx)))

    def set_var(self, vid=None, val=None, *a, **k):
        self.cmds.append(('set_var', (vid, val)))

    def set_label(self, name=None, *a, **k):
        self.cmds.append(('set_label', name))

    def jmp_nz(self, vid=None, label=None, *a, **k):
        self.cmds.append(('jmp_nz', (vid, label)))

    def wait_for_peer_close(self, *a, **k):
        self.cmds.append(('wait_for_peer_close', None))

    def __getattr__(self, name):
        # any other program method (connect/reset/jmp/set_tick_var/...) is a
        # no-op we don't model - keeps the template loadable (best-effort).
        def _noop(*a, **k):
            return None
        return _noop


class ASTFTCPClientTemplate(_Rec):
    pass


class ASTFTCPServerTemplate(_Rec):
    pass


class ASTFTemplate(_Rec):
    pass


class ASTFProfile(_Rec):
    pass


class _AnyMeta(type):
    def __getattr__(cls, name):
        return 0


def _generic(name):
    return _AnyMeta(str(name), (_Rec,), {})


_API = {
    'ASTFIPGenDist': ASTFIPGenDist, 'ASTFIPGenGlobal': ASTFIPGenGlobal, 'ASTFIPGen': ASTFIPGen,
    'ASTFGlobalInfo': ASTFGlobalInfo, 'ASTFCapInfo': ASTFCapInfo, 'ASTFAssociationRule': ASTFAssociationRule,
    'ASTFProgram': ASTFProgram, 'ASTFTCPClientTemplate': ASTFTCPClientTemplate,
    'ASTFTCPServerTemplate': ASTFTCPServerTemplate, 'ASTFTemplate': ASTFTemplate, 'ASTFProfile': ASTFProfile,
    'ASTFGlobalInfoPerTemplate': _generic('ASTFGlobalInfoPerTemplate'),
    'ASTFError': type('ASTFError', (Exception,), {}),
}


def _install_fake_trex():
    api = types.ModuleType('trex.astf.api')
    for name, obj in _API.items():
        setattr(api, name, obj)
    for name in dir(scapy_all):
        if not name.startswith('_') and not hasattr(api, name):
            setattr(api, name, getattr(scapy_all, name))
    api.os = os

    def _api_getattr(name):
        # never fabricate dunders (e.g. __all__ / __path__) - `import *` probes
        # __all__ and would then try to iterate the fake class.
        if name.startswith('__') and name.endswith('__'):
            raise AttributeError(name)
        obj = _generic(name)
        setattr(api, name, obj)
        return obj
    api.__getattr__ = _api_getattr

    trex = types.ModuleType('trex'); trex.__path__ = []
    astf = types.ModuleType('trex.astf'); astf.__path__ = []
    trex.astf = astf
    sys.modules['trex'] = trex
    sys.modules['trex.astf'] = astf
    sys.modules['trex.astf.api'] = api
    for alias in ('trex.astf.tunnels_topo', 'trex.astf.trex_astf_profile'):
        sys.modules[alias] = api


# --- model construction ------------------------------------------------------
_TCP_FIELDS = ['mss', 'rxbufsize', 'txbufsize', 'initwnd', 'no_delay', 'do_rfc1323',
               'keepinit', 'keepidle', 'keepintvl', 'no_delay_counter', 'delay_ack_msec']


def _side_globals():
    return {
        'tcp': {f: None for f in _TCP_FIELDS},
        'ip': {'tos': None, 'ttl': None},
        'scheduler': {'rampupSec': None},
        'ipv6': {'enable': False, 'srcMsb': '', 'dstMsb': ''},
    }


def _num(v):
    if isinstance(v, bool):
        return v
    if isinstance(v, (int, float)):
        return v
    try:
        return int(v)
    except (TypeError, ValueError):
        try:
            return float(v)
        except (TypeError, ValueError):
            return v


def _ipgen_to_model(ipgen):
    if not isinstance(ipgen, ASTFIPGen):
        return None
    kw = ipgen._kw

    def dist(d):
        if d is None:
            return {'start': '', 'end': '', 'distribution': 'seq', 'perCore': None}
        dk = d._kw
        rng = dk.get('ip_range')
        if rng is None and d._args:
            rng = d._args[0]
        rng = rng or ['', '']
        dst = dk.get('distribution') or (d._args[1] if len(d._args) > 1 else 'seq')
        return {'start': rng[0], 'end': rng[1], 'distribution': dst,
                'perCore': dk.get('per_core_distribution')}
    glob = kw.get('glob')
    offset = '1.0.0.0'
    if isinstance(glob, ASTFIPGenGlobal):
        offset = glob._kw.get('ip_offset') or (glob._args[0] if glob._args else '1.0.0.0')
    return {'client': dist(kw.get('dist_client')), 'server': dist(kw.get('dist_server')), 'ipOffset': offset}


def _glob_to_model(gi):
    m = _side_globals()
    if not isinstance(gi, ASTFGlobalInfo):
        return m
    tcp = vars(gi.tcp)
    for f in _TCP_FIELDS:
        if f in tcp:
            m['tcp'][f] = _num(tcp[f])
    ip = vars(gi.ip)
    if 'tos' in ip:
        m['ip']['tos'] = _num(ip['tos'])
    if 'ttl' in ip:
        m['ip']['ttl'] = _num(ip['ttl'])
    sch = vars(gi.scheduler)
    if 'rampup_sec' in sch:
        m['scheduler']['rampupSec'] = _num(sch['rampup_sec'])
    v6 = vars(gi.ipv6)
    if v6.get('enable'):
        m['ipv6']['enable'] = True
        if 'src_msb' in v6:
            m['ipv6']['srcMsb'] = str(v6['src_msb'])
        if 'dst_msb' in v6:
            m['ipv6']['dstMsb'] = str(v6['dst_msb'])
    return m


def _buf_payload(buf):
    if buf is None:
        return {'kind': 'text', 'text': ''}
    if isinstance(buf, (bytes, bytearray)):
        s = bytes(buf).decode('latin-1')
    else:
        s = str(buf)
    return {'kind': 'text', 'text': s}


def _cmds_to_model(prog):
    out = []
    if prog is None or not hasattr(prog, 'cmds'):
        return out
    for op, arg in prog.cmds:
        if op == 'send':
            out.append({'op': 'send', 'payload': _buf_payload(arg)})
        elif op == 'send_msg':
            out.append({'op': 'send_msg', 'payload': _buf_payload(arg)})
        elif op == 'recv':
            out.append({'op': 'recv', 'bytes': _num(arg) if arg is not None else None})
        elif op == 'recv_msg':
            out.append({'op': 'recv_msg', 'count': _num(arg) or 1})
        elif op == 'delay':
            out.append({'op': 'delay', 'usec': _num(arg) or 0})
        elif op == 'delay_rand':
            out.append({'op': 'delay_rand', 'minUsec': _num(arg[0]) or 0, 'maxUsec': _num(arg[1]) or 0})
        elif op == 'set_var':
            out.append({'op': 'set_var', 'id': str(arg[0]), 'value': _num(arg[1]) or 0})
        elif op == 'set_label':
            out.append({'op': 'set_label', 'name': str(arg)})
        elif op == 'jmp_nz':
            out.append({'op': 'jmp_nz', 'id': str(arg[0]), 'label': str(arg[1])})
        elif op == 'wait_for_peer_close':
            out.append({'op': 'wait_for_peer_close'})
    return out


def _same_ranges(a, b):
    return (a and b and a['client']['start'] == b['client']['start'] and
            a['client']['end'] == b['client']['end'] and
            a['server']['start'] == b['server']['start'] and
            a['server']['end'] == b['server']['end'])


def _override(ipgen, default_model):
    om = _ipgen_to_model(ipgen)
    if om is None or _same_ranges(om, default_model):
        return None
    return om


def _cap_to_model(cap, default_ipgen):
    kw = cap._kw
    f = kw.get('file') or (cap._args[0] if cap._args else '')
    return {'file': f, 'cps': _num(kw.get('cps')), 'port': _num(kw.get('port')) if kw.get('port') is not None else None,
            'sDelayUsec': _num(kw.get('s_delay')) if kw.get('s_delay') is not None else None,
            'ipGenOverride': _override(kw.get('ip_gen'), default_ipgen)}


def _template_to_model(tpl, idx, default_ipgen):
    tk = tpl._kw
    ct = tk.get('client_template')
    st = tk.get('server_template')
    ck = ct._kw if isinstance(ct, _Rec) else {}
    sk = st._kw if isinstance(st, _Rec) else {}
    progc = ck.get('program')
    progs = sk.get('program')
    assoc = sk.get('assoc')
    assoc_port = None
    if isinstance(assoc, ASTFAssociationRule):
        assoc_port = assoc._args[0] if assoc._args else assoc._kw.get('port')
    port = ck.get('port')
    return {
        'id': 't_%s' % (tk.get('tg_name') or idx),
        'tgName': tk.get('tg_name'),
        'cps': _num(ck.get('cps')) if ck.get('cps') is not None else 1,
        'assocPort': _num(port) if port is not None else (_num(assoc_port) if assoc_port is not None else None),
        'stream': not (getattr(progc, 'stream', True) is False),
        'client': {'commands': _cmds_to_model(progc)},
        'server': {'commands': _cmds_to_model(progs)},
        'ipGenOverride': _override(ck.get('ip_gen'), default_ipgen),
    }


def _call_get_profile(obj):
    fn = getattr(obj, 'get_profile', None)
    if fn is None:
        raise RuntimeError("register() object has no get_profile()")
    try:
        params = [p for p in inspect.signature(fn).parameters.values()]
    except (TypeError, ValueError):
        params = []
    supply = {'tunables': [], 'kwargs': {}}
    call_kw = {}
    for p in params:
        if p.name in supply and p.kind in (p.POSITIONAL_OR_KEYWORD, p.KEYWORD_ONLY):
            call_kw[p.name] = supply[p.name]
    try:
        return fn(**call_kw)
    except TypeError:
        for attempt in ([], [[]]):
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
    register = ns.get('register')
    if not callable(register):
        return {"ok": False, "error": "profile has no register() function"}
    profile = _call_get_profile(register())
    if not isinstance(profile, ASTFProfile):
        return {"ok": False, "error": "get_profile did not return an ASTFProfile"}

    pk = profile._kw
    default_ipgen = _ipgen_to_model(pk.get('default_ip_gen')) or {
        'client': {'start': '16.0.0.1', 'end': '16.0.0.255', 'distribution': 'seq', 'perCore': None},
        'server': {'start': '48.0.0.1', 'end': '48.0.255.255', 'distribution': 'seq', 'perCore': None},
        'ipOffset': '1.0.0.0'}

    model = {
        'kind': 'astf', 'schemaVersion': 1, 'trexVersion': '3.06',
        'meta': {'name': os.path.splitext(os.path.basename(path))[0], 'description': '', 'modified': ''},
        'ipGen': default_ipgen,
        'globals': {'client': _glob_to_model(pk.get('default_c_glob_info')),
                    'server': _glob_to_model(pk.get('default_s_glob_info'))},
        'mode': 'pcap', 'capList': [], 'templates': [],
        'tunnelsTopo': {'enabled': False, 'ctxs': [{'srcStart': '16.0.0.1', 'srcEnd': '16.0.0.255',
            'initialTeid': 0, 'teidJump': 1, 'sport': 5000, 'version': 4,
            'srcIp': '1.1.1.11', 'dstIp': '12.2.2.2', 'activate': True}]},
    }

    cap_list = pk.get('cap_list')
    templates = pk.get('templates')
    if cap_list:
        model['mode'] = 'pcap'
        caps = cap_list if isinstance(cap_list, (list, tuple)) else [cap_list]
        for c in caps:
            if isinstance(c, ASTFCapInfo):
                model['capList'].append(_cap_to_model(c, default_ipgen))
    elif templates:
        model['mode'] = 'program'
        tpls = templates if isinstance(templates, (list, tuple)) else [templates]
        idx = 0
        for t in tpls:
            if isinstance(t, ASTFTemplate):
                model['templates'].append(_template_to_model(t, idx, default_ipgen))
                idx += 1

    if not model['capList'] and not model['templates']:
        return {"ok": False, "error": "profile produced no cap_list or templates"}
    return {"ok": True, "engine": "python-exec",
            "resolved": len(model['capList']) + len(model['templates']), "model": model}


def main():
    if len(sys.argv) < 2:
        _emit({"ok": False, "error": "usage: astf_resolve.py <profile.py>"})
        return
    try:
        _emit(resolve(sys.argv[1]))
    except Exception as exc:  # noqa: BLE001 - report any failure as data
        import traceback
        _emit({"ok": False, "error": "%s: %s" % (type(exc).__name__, exc),
               "trace": traceback.format_exc()[-1500:]})


if __name__ == "__main__":
    main()
