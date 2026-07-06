/* TRex Profile & Config Builder - core utilities.
 * Classic script (no ES modules - they break on file://). Attaches to the TB namespace.
 * Environment-agnostic so generator code can also run under Node for tests. */
(function (root) {
  'use strict';
  var TB = root.TB = root.TB || {};

  var counter = 0;

  TB.util = {
    uid: function (prefix) {
      counter += 1;
      return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + counter;
    },

    deepClone: function (obj) {
      return obj === undefined ? undefined : JSON.parse(JSON.stringify(obj));
    },

    todayIso: function () {
      var d = new Date();
      var m = String(d.getMonth() + 1);
      var day = String(d.getDate());
      if (m.length < 2) { m = '0' + m; }
      if (day.length < 2) { day = '0' + day; }
      return d.getFullYear() + '-' + m + '-' + day;
    },

    isIpv4: function (s) {
      if (typeof s !== 'string') { return false; }
      var parts = s.split('.');
      if (parts.length !== 4) { return false; }
      for (var i = 0; i < 4; i++) {
        if (!/^\d{1,3}$/.test(parts[i])) { return false; }
        var n = parseInt(parts[i], 10);
        if (n < 0 || n > 255) { return false; }
      }
      return true;
    },

    isIpv6: function (s) {
      // Loose check: hex groups separated by ':' with optional '::' compression.
      if (typeof s !== 'string' || s.indexOf(':') === -1) { return false; }
      return /^[0-9a-fA-F:]{2,39}$/.test(s) && s.split('::').length <= 2;
    },

    isMac: function (s) {
      return typeof s === 'string' && /^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/.test(s);
    },

    // Escape &, < and > only. Quotes are left intact so the syntax highlighter
    // can still match string literals; output is only ever used as element
    // innerHTML, never inside attributes.
    escapeHtml: function (s) {
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },

    downloadText: function (filename, text) {
      var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    },

    // Copy with fallback for file:// where navigator.clipboard is unavailable.
    copyText: function (text) {
      return new Promise(function (resolve) {
        if (root.navigator && root.navigator.clipboard && root.navigator.clipboard.writeText) {
          root.navigator.clipboard.writeText(text).then(
            function () { resolve(true); },
            function () { resolve(TB.util._execCopy(text)); }
          );
        } else {
          resolve(TB.util._execCopy(text));
        }
      });
    },

    _execCopy: function (text) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
      } catch (e) {
        return false;
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
