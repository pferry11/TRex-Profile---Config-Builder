"""TRex Profile & Config Builder - optional Flask wrapper.

Serves the static app unchanged and adds conveniences that only make sense
when running on (or near) the TRex box itself:

  GET  /api/ping      - feature detection for the frontend
  GET  /api/pcaps     - list .pcap/.cap files under the TRex directory
  POST /api/validate  - run stl-sim / astf-sim against a generated profile

The static app keeps working without this server (opened from file://);
the frontend probes /api/ping and hides backend features when it is absent.

Usage:
    pip install flask
    TREX_DIR=/opt/trex/v3.06 python app.py          # defaults shown below

Env vars: TREX_DIR (default /opt/trex/v3.06), TREXB_HOST (127.0.0.1),
TREXB_PORT (8080).
"""
import os
import sys
import json
import subprocess
import tempfile

from flask import Flask, jsonify, request

TREX_DIR = os.environ.get('TREX_DIR', '/opt/trex/v3.06')
HOST = os.environ.get('TREXB_HOST', '127.0.0.1')
PORT = int(os.environ.get('TREXB_PORT', '8080'))
SIM_TIMEOUT_SEC = 30
RESOLVE_SCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tools', 'stl_resolve.py')

app = Flask(__name__, static_folder='.', static_url_path='')

# The ONLY commands this server will ever execute (kind -> argv template).
SIM_COMMANDS = {
    'stl': ['{trex}/stl-sim', '-f', '{tmp}', '-o', '/tmp/trexb_val.pcap', '-l', '50'],
    'astf': ['{trex}/astf-sim', '-f', '{tmp}', '--full', '-o', '/tmp/'],
}


@app.route('/')
def index():
    return app.send_static_file('index.html')


@app.route('/api/ping')
def ping():
    return jsonify(ok=True, version='1', trexDir=TREX_DIR)


@app.route('/api/pcaps')
def pcaps():
    sub = request.args.get('dir', 'avl')
    root = os.path.realpath(TREX_DIR)
    target = os.path.realpath(os.path.join(root, sub))
    # path-traversal guard: the resolved path must stay under TREX_DIR
    if target != root and not target.startswith(root + os.sep):
        return jsonify(error='path escapes the TRex directory'), 400
    if not os.path.isdir(target):
        return jsonify(error='not a directory under the TRex dir: ' + sub), 404
    files = sorted(
        f for f in os.listdir(target)
        if f.lower().endswith(('.pcap', '.cap')) and os.path.isfile(os.path.join(target, f))
    )
    return jsonify(dir=sub, files=files)


@app.route('/api/validate', methods=['POST'])
def validate():
    data = request.get_json(silent=True) or {}
    kind = data.get('kind')
    content = data.get('content')
    if kind not in SIM_COMMANDS:
        return jsonify(error='kind must be "stl" or "astf"'), 400
    if not isinstance(content, str) or not content.strip():
        return jsonify(error='content (profile source text) is required'), 400

    fd, tmp = tempfile.mkstemp(suffix='.py', prefix='trexb_val_')
    try:
        with os.fdopen(fd, 'w') as f:
            f.write(content)
        cmd = [a.format(trex=TREX_DIR, tmp=tmp) for a in SIM_COMMANDS[kind]]
        try:
            proc = subprocess.run(cmd, capture_output=True, text=True,
                                  timeout=SIM_TIMEOUT_SEC, cwd=TREX_DIR)
            return jsonify(exitCode=proc.returncode,
                           stdout=proc.stdout[-20000:], stderr=proc.stderr[-20000:],
                           command=' '.join(cmd))
        except subprocess.TimeoutExpired:
            return jsonify(exitCode=-1, stdout='',
                           stderr='simulator timed out after %d s' % SIM_TIMEOUT_SEC,
                           command=' '.join(cmd))
        except OSError as exc:
            return jsonify(exitCode=-1, stdout='',
                           stderr='could not run simulator: %s' % exc,
                           command=' '.join(cmd))
    finally:
        try:
            os.unlink(tmp)
        except OSError:
            pass


@app.route('/api/import_profile', methods=['POST'])
def import_profile():
    """Resolve an STL .py profile into an editable builder model by EXECUTING it
    (tools/stl_resolve.py) - handling arbitrary Python the offline parser can't.

    Runs in a subprocess with a timeout, the same trust model as /api/validate
    (which already executes profiles via stl-sim). Only STL is supported today.
    """
    data = request.get_json(silent=True) or {}
    kind = data.get('kind')
    content = data.get('content')
    if kind != 'stl':
        return jsonify(ok=False, error='server resolve currently supports kind "stl" only'), 400
    if not isinstance(content, str) or not content.strip():
        return jsonify(ok=False, error='content (profile source text) is required'), 400

    fd, tmp = tempfile.mkstemp(suffix='.py', prefix='trexb_resolve_')
    try:
        with os.fdopen(fd, 'w') as f:
            f.write(content)
        cmd = [sys.executable, RESOLVE_SCRIPT, tmp]
        try:
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=SIM_TIMEOUT_SEC)
        except subprocess.TimeoutExpired:
            return jsonify(ok=False, error='resolver timed out after %d s' % SIM_TIMEOUT_SEC), 504
        except OSError as exc:
            return jsonify(ok=False, error='could not run resolver: %s' % exc), 500
        out = (proc.stdout or '').strip()
        line = out.splitlines()[-1] if out else ''
        try:
            result = json.loads(line)
        except ValueError:
            return jsonify(ok=False, error='resolver produced no result',
                           stderr=(proc.stderr or '')[-4000:]), 500
        return jsonify(result)
    finally:
        try:
            os.unlink(tmp)
        except OSError:
            pass


if __name__ == '__main__':
    print('TRex Profile & Config Builder on http://%s:%d  (TREX_DIR=%s)' % (HOST, PORT, TREX_DIR))
    app.run(host=HOST, port=PORT)
