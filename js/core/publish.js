/* TRex Profile & Config Builder - publish a generated STL profile to a
 * running TRex-Backend (the team control app). The backend writes it into its
 * vetted-profiles dir, where the dashboard picks it up (allowlisted, with its
 * # Summary:). This is the "seam" between the authoring app and the runtime app.
 *
 * URL/filename builders are pure (unit-tested); send() does the fetch. */
(function (root) {
  'use strict';
  var TB = root.TB = root.TB || {};

  /* host + optional port -> "http://host:port" (no trailing slash).
   * Accepts host already carrying a scheme; blank port -> 8000. */
  function targetUrl(host, port) {
    var h = String(host == null ? '' : host).trim();
    if (!h) { return null; }
    h = h.replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(h)) { h = 'http://' + h; }
    // If the host already includes a :port, keep it; else append.
    var afterScheme = h.replace(/^https?:\/\//i, '');
    if (afterScheme.indexOf(':') === -1) {
      var p = String(port == null ? '' : port).trim() || '8000';
      h = h + ':' + p;
    }
    return h;
  }

  /* Mirror of the backend's accepted filename shape so the UI can show the
   * final name and catch obvious problems before the round-trip. */
  function profileFileName(name) {
    var base = String(name == null ? '' : name).trim();
    if (!base) { base = 'profile'; }
    base = base.replace(/[^\w.-]+/g, '_');
    if (!/\.py$/i.test(base)) { base += '.py'; }
    return base;
  }

  /* POST the profile. Resolves with the backend JSON; rejects with an Error
   * whose message is the backend's error text (guardrail messages included). */
  function send(baseUrl, name, content) {
    var url = String(baseUrl).replace(/\/+$/, '') + '/profiles/upload';
    return root.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: profileFileName(name), content: content })
    }).then(function (r) {
      return r.json().then(function (data) {
        if (!r.ok) { throw new Error(data.error || ('HTTP ' + r.status)); }
        return data;
      }, function () {
        throw new Error('HTTP ' + r.status + ' (no JSON body)');
      });
    });
  }

  TB.publish = { targetUrl: targetUrl, profileFileName: profileFileName, send: send };
})(typeof window !== 'undefined' ? window : globalThis);
