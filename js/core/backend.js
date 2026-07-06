/* TRex Profile & Config Builder - optional backend bridge (Flask app.py).
 * Probes /api/ping once at load; every backend feature in the UI checks
 * TB.backend.available synchronously at render time. When the app runs from
 * file:// (or the server is absent) everything stays hidden with zero noise. */
(function (root) {
  'use strict';
  var TB = root.TB = root.TB || {};

  var resolveReady;

  TB.backend = {
    available: false,
    trexDir: null,
    /* resolves (never rejects) once the probe has finished */
    ready: new Promise(function (res) { resolveReady = res; }),

    probe: function () {
      var done = function () { resolveReady(TB.backend.available); };
      try {
        if (typeof root.location === 'undefined' ||
            (root.location.protocol !== 'http:' && root.location.protocol !== 'https:') ||
            typeof root.fetch !== 'function') {
          done();
          return;
        }
        var ctrl = (typeof root.AbortController !== 'undefined') ? new root.AbortController() : null;
        var timer = setTimeout(function () { if (ctrl) { ctrl.abort(); } }, 2000);
        root.fetch('/api/ping', ctrl ? { signal: ctrl.signal } : {})
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (data) {
            clearTimeout(timer);
            if (data && data.ok) {
              TB.backend.available = true;
              TB.backend.trexDir = data.trexDir || null;
            }
            done();
          })
          .catch(function () { clearTimeout(timer); done(); });
      } catch (e) {
        done();
      }
    },

    listPcaps: function (dir) {
      return root.fetch('/api/pcaps?dir=' + encodeURIComponent(dir))
        .then(function (r) {
          return r.json().then(function (data) {
            if (!r.ok) { throw new Error(data.error || ('HTTP ' + r.status)); }
            return data;
          });
        });
    },

    validate: function (kind, content) {
      return root.fetch('/api/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: kind, content: content })
      }).then(function (r) {
        return r.json().then(function (data) {
          if (!r.ok) { throw new Error(data.error || ('HTTP ' + r.status)); }
          return data;
        });
      });
    }
  };

  TB.backend.probe();
})(typeof window !== 'undefined' ? window : globalThis);
