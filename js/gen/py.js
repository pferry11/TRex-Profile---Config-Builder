/* TRex Profile & Config Builder - Python code generation primitives shared by
 * the profile generators. */
(function (root) {
  'use strict';
  var TB = root.TB = root.TB || {};
  TB.gen = TB.gen || {};

  function escapePy(s, quote) {
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (c === '\\') { out += '\\\\'; }
      else if (c === quote) { out += '\\' + quote; }
      else if (c === '\n') { out += '\\n'; }
      else if (c === '\r') { out += '\\r'; }
      else if (c === '\t') { out += '\\t'; }
      else { out += c; }
    }
    return out;
  }

  TB.gen.py = {
    // Double-quoted string literal (used for IPs, offsets, ops - matches TRex examples).
    dq: function (s) { return '"' + escapePy(String(s), '"') + '"'; },

    // Single-quoted string literal (used for names, help text - matches TRex examples).
    sq: function (s) { return "'" + escapePy(String(s), "'") + "'"; },

    num: function (n) { return String(n); },

    // Auto literal: numbers stay numbers, numeric strings become numbers,
    // anything else becomes a double-quoted string.
    val: function (v) {
      if (typeof v === 'number') { return String(v); }
      if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim())) { return v.trim(); }
      return TB.gen.py.dq(v);
    },

    header: function (opts) {
      var lines = [
        '# ' + new Array(78).join('-'),
        '# TRex Profile & Config Builder - ' + opts.title,
        '# Generated: ' + opts.date,
        '# Target: TRex v' + opts.trexVersion,
        '# Validate on the TRex box: ' + opts.validate,
        '# Re-edit: load ' + opts.modelFile + ' in TRex Profile & Config Builder',
        '# ' + new Array(78).join('-')
      ];
      return lines;
    },

    // "# Summary:" comment block from plain-English sentences (see summarize.js).
    summaryComment: function (sentences) {
      if (!sentences || !sentences.length) { return []; }
      var out = ['# Summary:'];
      sentences.forEach(function (l) { out.push('#   ' + l); });
      return out;
    },

    // argparse block used inside get_streams/get_profile. Returns indented lines.
    argparseLines: function (tunables, indent) {
      var py = TB.gen.py;
      var lines = [];
      lines.push(indent + "parser = argparse.ArgumentParser(description='trexb generated profile',");
      lines.push(indent + '                                 formatter_class=argparse.ArgumentDefaultsHelpFormatter)');
      for (var i = 0; i < tunables.length; i++) {
        var t = tunables[i];
        var parts = ["'--" + t.name + "'"];
        if (t.type === 'int') { parts.push('type=int'); }
        else if (t.type === 'float') { parts.push('type=float'); }
        else { parts.push('type=str'); }
        if (t.type === 'choice' && Array.isArray(t.choices) && t.choices.length) {
          parts.push('choices=[' + t.choices.map(function (c) { return py.sq(c); }).join(', ') + ']');
        }
        if (t.type === 'int' || t.type === 'float') {
          parts.push('default=' + py.num(t.default));
        } else {
          parts.push('default=' + py.sq(t.default));
        }
        parts.push('help=' + py.sq(t.help || ''));
        lines.push(indent + 'parser.add_argument(' + parts.join(', ') + ')');
      }
      lines.push(indent + 'args = parser.parse_args(tunables)');
      return lines;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
