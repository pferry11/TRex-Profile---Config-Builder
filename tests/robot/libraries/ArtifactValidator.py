"""T1 tier - static validity checks for every generated artifact family.

Answers the question the golden tests cannot: "are the bytes we emit actually
well-formed input for the thing that consumes them?" A golden proves output did
not change; this proves it parses. Both matter, and a generator can pass its
golden while emitting a broken file if the golden was updated carelessly.

Deliberately does NOT need a TRex install - that is tier 3's job (stl-sim /
astf-sim on the box). Everything here runs on the dev PC in milliseconds.
"""
import ast
import json
import re
import zipfile
from pathlib import Path

try:
    import yaml
except ImportError:  # pragma: no cover - surfaced as a clear Robot failure
    yaml = None

ROBOT_LIBRARY_SCOPE = "GLOBAL"


class ArtifactValidator:
    """Robot keyword library. Every keyword raises AssertionError on failure so
    Robot reports the artifact path and the underlying parser message."""

    # ---------------- Python profiles (STL / ASTF / EMU) ----------------

    def python_artifact_compiles(self, path):
        """Compile a generated .py profile. Catches syntax errors, bad
        indentation and stray text in the header/summary blocks - the classes
        of defect a string-diff golden happily preserves."""
        src = Path(path).read_text(encoding="utf-8")
        try:
            compile(src, str(path), "exec")
        except SyntaxError as exc:
            raise AssertionError(
                "%s is not valid Python: line %s: %s" % (path, exc.lineno, exc.msg)
            )
        return True

    def python_artifact_defines_register(self, path):
        """A TRex profile module is only loadable if it exposes register().
        Asserted via the AST rather than a substring so a mention inside a
        comment or the # Summary: block cannot satisfy it."""
        tree = ast.parse(Path(path).read_text(encoding="utf-8"), str(path))
        names = {
            n.name for n in ast.walk(tree)
            if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef))
        }
        if "register" not in names:
            raise AssertionError(
                "%s defines no register() - TRex cannot load it as a profile "
                "(found: %s)" % (path, ", ".join(sorted(names)) or "nothing")
            )
        return True

    # ---------------- YAML (cap2 profiles, trex_cfg) ----------------

    def yaml_artifact_parses(self, path):
        """Parse with safe_load and return the document. TRex's own YAML reader
        is stricter than a substring check; this is the cheapest way to catch an
        indentation or quoting bug in the generator."""
        self._require_yaml()
        text = Path(path).read_text(encoding="utf-8")
        try:
            doc = yaml.safe_load(text)
        except yaml.YAMLError as exc:
            raise AssertionError("%s is not valid YAML: %s" % (path, exc))
        if doc is None:
            raise AssertionError("%s parsed as an empty YAML document" % path)
        return doc

    def cap2_yaml_has_required_shape(self, path):
        """cap2 profiles are a single-element list whose entry carries the
        generator block and a non-empty cap_info list (the shape TRex's STF
        loader expects)."""
        doc = self.yaml_artifact_parses(path)
        if not isinstance(doc, list) or len(doc) != 1:
            raise AssertionError(
                "%s: cap2 must be a single-element list at the top level, got %s"
                % (path, type(doc).__name__)
            )
        entry = doc[0]
        for key in ("generator", "cap_info"):
            if key not in entry:
                raise AssertionError("%s: cap2 entry is missing '%s'" % (path, key))
        if not entry["cap_info"]:
            raise AssertionError("%s: cap_info is empty" % path)
        return True

    def trex_cfg_has_required_shape(self, path):
        """trex_cfg.yaml: single-element list carrying interfaces + port_limit,
        and port_limit must agree with the interface count (a mismatch is the
        classic cause of TRex refusing to start)."""
        doc = self.yaml_artifact_parses(path)
        if not isinstance(doc, list) or len(doc) != 1:
            raise AssertionError("%s: trex_cfg must be a single-element list" % path)
        entry = doc[0]
        for key in ("interfaces", "port_limit"):
            if key not in entry:
                raise AssertionError("%s: trex_cfg is missing '%s'" % (path, key))
        if len(entry["interfaces"]) != entry["port_limit"]:
            raise AssertionError(
                "%s: port_limit is %s but %s interfaces are listed - TRex will refuse to start"
                % (path, entry["port_limit"], len(entry["interfaces"]))
            )
        return True

    # ---------------- JSON (TPG tags) ----------------

    def json_artifact_parses(self, path):
        text = Path(path).read_text(encoding="utf-8")
        try:
            return json.loads(text)
        except json.JSONDecodeError as exc:
            raise AssertionError("%s is not valid JSON: %s" % (path, exc))

    def tpg_tags_have_required_shape(self, path):
        """The tags file is a list of tag objects, each with a type and the
        matching value block (dot1q / qinq)."""
        doc = self.json_artifact_parses(path)
        if not isinstance(doc, list) or not doc:
            raise AssertionError("%s: TPG tags must be a non-empty list" % path)
        for i, tag in enumerate(doc):
            if "type" not in tag:
                raise AssertionError("%s: tag %d has no 'type'" % (path, i))
            if tag["type"] not in ("Dot1Q", "QinQ"):
                raise AssertionError(
                    "%s: tag %d has unknown type %r" % (path, i, tag["type"])
                )
            if "value" not in tag:
                raise AssertionError("%s: tag %d has no 'value' block" % (path, i))
        return True

    # ---------------- BIRD configs ----------------

    def bird_conf_is_balanced(self, path):
        """BIRD has no offline syntax checker we can rely on off-box, so assert
        the two things a generator realistically gets wrong: unbalanced braces
        and a missing router id."""
        text = Path(path).read_text(encoding="utf-8")
        stripped = re.sub(r"#.*", "", text)
        depth = 0
        for ch in stripped:
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth < 0:
                    raise AssertionError("%s: unbalanced '}' - closes more blocks than it opens" % path)
        if depth != 0:
            raise AssertionError("%s: %d unclosed '{' block(s)" % (path, depth))
        if "router id" not in text:
            raise AssertionError("%s: no 'router id' - BIRD will not start" % path)
        return True

    # ---------------- shell launch scripts ----------------

    def shell_script_looks_runnable(self, path):
        """Off-box we cannot run `bash -n` reliably (tier 3 does that on the
        box), so assert the structural essentials: a shebang and at least one
        t-rex-64 invocation."""
        text = Path(path).read_text(encoding="utf-8")
        if not text.startswith("#!"):
            raise AssertionError("%s: no shebang line" % path)
        if "t-rex-64" not in text:
            raise AssertionError("%s: script never invokes t-rex-64" % path)
        return True

    # ---------------- bundles ----------------

    def zip_bundle_is_readable(self, path, expected_members=None):
        """Bundle export: the zip must open, every member must be non-empty, and
        the CRCs must check out (the app ships its own dependency-free zip
        writer, so this is genuinely worth asserting)."""
        with zipfile.ZipFile(path) as zf:
            bad = zf.testzip()
            if bad is not None:
                raise AssertionError("%s: corrupt member %s" % (path, bad))
            names = zf.namelist()
            for name in names:
                if zf.getinfo(name).file_size == 0:
                    raise AssertionError("%s: member %s is empty" % (path, name))
            for want in (expected_members or []):
                if not any(want in n for n in names):
                    raise AssertionError(
                        "%s: expected a member matching %r, got %s" % (path, want, names)
                    )
        return names

    # ---------------- shared assertions ----------------

    def artifact_has_summary_block(self, path):
        """Every generated artifact carries a plain-English '# Summary:' - the
        same text the UI shows in its 'What this does' box, and what a teammate
        reads on the box. An empty or missing summary is a real defect: it is
        the only explanation of the file that travels with it."""
        text = Path(path).read_text(encoding="utf-8")
        if "Summary:" not in text:
            raise AssertionError("%s: no '# Summary:' block" % path)
        after = text.split("Summary:", 1)[1].lstrip("\r\n")
        first = after.splitlines()[0] if after.splitlines() else ""
        if not first.strip(" #\t"):
            raise AssertionError("%s: '# Summary:' block is present but empty" % path)
        return True

    def artifact_is_not_empty(self, path, min_bytes=50):
        size = Path(path).stat().st_size
        if size < int(min_bytes):
            raise AssertionError(
                "%s is only %d bytes - the generator produced a stub" % (path, size)
            )
        return size

    # ---------------- internals ----------------

    @staticmethod
    def _require_yaml():
        if yaml is None:
            raise AssertionError(
                "PyYAML is not installed - run: pip install pyyaml"
            )
