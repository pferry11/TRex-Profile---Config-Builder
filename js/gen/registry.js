/* TRex Profile & Config Builder - per-TRex-version generator registry.
 * All UI code resolves generators through this registry using the model's
 * trexVersion, so a future TRex version (3.07, 3.08, ...) is added by
 * registering a new generator set - no UI or model changes required. */
(function (root) {
  'use strict';
  var TB = root.TB = root.TB || {};
  TB.gen = TB.gen || {};

  TB.gen.registry = TB.gen.registry || {};

  TB.gen.register = function (trexVersion, kind, generateFn) {
    TB.gen.registry[trexVersion] = TB.gen.registry[trexVersion] || {};
    TB.gen.registry[trexVersion][kind] = generateFn;
  };

  TB.gen.versions = function () {
    return Object.keys(TB.gen.registry).sort();
  };

  // Resolve a generator for a model; returns null if the version/kind pair
  // is not registered (the UI shows a clear message instead of crashing).
  TB.gen.resolve = function (trexVersion, kind) {
    var set = TB.gen.registry[trexVersion];
    return (set && set[kind]) ? set[kind] : null;
  };
})(typeof window !== 'undefined' ? window : globalThis);
