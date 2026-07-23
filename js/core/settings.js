/* TRex Profile & Config Builder - settings schema and accessors.
 * The settings UI arrives in a later phase; this module defines the schema,
 * defaults and read/write helpers used across the app. */
(function (root) {
  'use strict';
  var TB = root.TB = root.TB || {};

  var DEFAULT_ACCENT = '#3b9cff';

  /* '#3b9cff' | '3b9cff' | '#39f' -> {r,g,b}, or null if it is not a hex colour.
   * Anything unparseable falls back to the default rather than clearing the
   * variable, so a hand-edited or corrupted workspace import cannot leave the
   * app with an unreadable, accent-less UI. */
  function parseHex(hex) {
    if (typeof hex !== 'string') { return null; }
    var h = hex.trim().replace(/^#/, '');
    if (/^[0-9a-fA-F]{3}$/.test(h)) {
      h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    }
    if (!/^[0-9a-fA-F]{6}$/.test(h)) { return null; }
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      hex: '#' + h.toLowerCase()
    };
  }

  function defaults() {
    return {
      schemaVersion: 1,
      defaults: {
        trexVersion: '3.06',
        pcapDir: '/opt/trex/v3.06/avl',
        activeServerId: null
      },
      /* Text-size percentages (100 = default). fontScale multiplies all text;
       * the group scales fine-tune element groups on top of it.
       * accent is the app-wide highlight hex (Settings -> Accent colour). */
      display: {
        fontScale: 100,
        labelScale: 100,
        controlScale: 100,
        codeScale: 100,
        manualScale: 100,
        accent: DEFAULT_ACCENT
      },
      servers: []
    };
  }

  TB.settings = {
    defaults: defaults,
    DEFAULT_ACCENT: DEFAULT_ACCENT,
    parseHex: parseHex,

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

      /* One hex drives the accent and both tint levels derived from it, so a
       * custom colour reaches every accented surface (tab underline, focus
       * borders, preset strip, tooltips) with no per-rule literals left over. */
      var c = parseHex(d.accent) || parseHex(DEFAULT_ACCENT);
      var rgb = c.r + ', ' + c.g + ', ' + c.b;
      st.setProperty('--accent', c.hex);
      st.setProperty('--accent-soft', 'rgba(' + rgb + ', 0.05)');
      st.setProperty('--accent-soft-strong', 'rgba(' + rgb + ', 0.16)');
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
