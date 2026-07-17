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
      /* Text-size percentages (100 = default). fontScale multiplies all text;
       * the group scales fine-tune element groups on top of it. */
      display: {
        fontScale: 100,
        labelScale: 100,
        controlScale: 100,
        codeScale: 100,
        manualScale: 100
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
      if (stored.display) {
        for (var d in stored.display) {
          if (Object.prototype.hasOwnProperty.call(stored.display, d)) {
            merged.display[d] = stored.display[d];
          }
        }
      }
      if (Array.isArray(stored.servers)) { merged.servers = stored.servers; }
      return merged;
    },

    save: function (settings) {
      return TB.persist.set(TB.persist.KEYS.settings, settings);
    },

    /* Push the display percentages onto the document as CSS variables.
     * Called at boot and live from the Settings tab sliders. */
    applyDisplay: function (settings) {
      if (typeof document === 'undefined') { return; }
      var d = (settings && settings.display) || defaults().display;
      function scale(v) {
        return (typeof v === 'number' && v >= 50 && v <= 300 ? v : 100) / 100;
      }
      var st = document.documentElement.style;
      st.setProperty('--font-scale', scale(d.fontScale));
      st.setProperty('--scale-labels', scale(d.labelScale));
      st.setProperty('--scale-controls', scale(d.controlScale));
      st.setProperty('--scale-code', scale(d.codeScale));
      st.setProperty('--scale-manual', scale(d.manualScale));
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
