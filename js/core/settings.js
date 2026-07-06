/* TRex Profile & Config Builder - settings schema and accessors.
 * The settings UI arrives in a later phase; this module defines the schema,
 * defaults and read/write helpers used across the app. */
(function (root) {
  'use strict';
  var TB = root.TB = root.TB || {};

  function defaults() {
    return {
      schemaVersion: 1,
      defaults: {
        trexVersion: '3.06',
        pcapDir: '/opt/trex/v3.06/avl',
        activeServerId: null
      },
      servers: []
    };
  }

  TB.settings = {
    defaults: defaults,

    get: function () {
      var stored = TB.persist.get(TB.persist.KEYS.settings, null);
      var base = defaults();
      if (!stored) { return base; }
      // Shallow-merge defaults so new fields appear for old stored settings.
      var merged = base;
      if (stored.defaults) {
        for (var k in stored.defaults) {
          if (Object.prototype.hasOwnProperty.call(stored.defaults, k)) {
            merged.defaults[k] = stored.defaults[k];
          }
        }
      }
      if (Array.isArray(stored.servers)) { merged.servers = stored.servers; }
      return merged;
    },

    save: function (settings) {
      return TB.persist.set(TB.persist.KEYS.settings, settings);
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
