/* TRex Profile & Config Builder - localStorage persistence with quota guard,
 * saved-profile registry and workspace export/import.
 * Falls back to an in-memory map when localStorage is unavailable (e.g. Node tests). */
(function (root) {
  'use strict';
  var TB = root.TB = root.TB || {};

  var KEYS = {
    settings: 'trexb.settings.v1',
    profiles: 'trexb.profiles.v1',
    ui: 'trexb.ui.v1'
  };

  var memoryStore = {};

  function storageGet(key) {
    try {
      if (root.localStorage) { return root.localStorage.getItem(key); }
    } catch (e) { /* fall through to memory */ }
    return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : null;
  }

  function storageSet(key, value) {
    try {
      if (root.localStorage) {
        root.localStorage.setItem(key, value);
        return { ok: true };
      }
    } catch (e) {
      return { ok: false, error: 'Could not save to browser storage (quota exceeded or storage disabled). Export your workspace to keep your work.' };
    }
    memoryStore[key] = value;
    return { ok: true };
  }

  TB.persist = {
    KEYS: KEYS,

    get: function (key, fallback) {
      var raw = storageGet(key);
      if (raw === null || raw === undefined) { return fallback; }
      try {
        return JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },

    set: function (key, value) {
      return storageSet(key, JSON.stringify(value));
    },

    /* ---- saved profile models (STL/ASTF/... share one registry) ---- */

    listProfiles: function (kind) {
      var all = TB.persist.get(KEYS.profiles, { schemaVersion: 1, items: [] });
      if (!kind) { return all.items; }
      return all.items.filter(function (m) { return m.kind === kind; });
    },

    getProfile: function (kind, name) {
      var items = TB.persist.listProfiles(kind);
      for (var i = 0; i < items.length; i++) {
        if (items[i].meta && items[i].meta.name === name) { return items[i]; }
      }
      return null;
    },

    saveProfile: function (model) {
      var all = TB.persist.get(KEYS.profiles, { schemaVersion: 1, items: [] });
      var replaced = false;
      for (var i = 0; i < all.items.length; i++) {
        var m = all.items[i];
        if (m.kind === model.kind && m.meta && model.meta && m.meta.name === model.meta.name) {
          all.items[i] = model;
          replaced = true;
          break;
        }
      }
      if (!replaced) { all.items.push(model); }
      return TB.persist.set(KEYS.profiles, all);
    },

    deleteProfile: function (kind, name) {
      var all = TB.persist.get(KEYS.profiles, { schemaVersion: 1, items: [] });
      all.items = all.items.filter(function (m) {
        return !(m.kind === kind && m.meta && m.meta.name === name);
      });
      return TB.persist.set(KEYS.profiles, all);
    },

    /* ---- workspace export/import (settings + all saved profiles) ---- */

    exportWorkspace: function () {
      return {
        trexbWorkspace: 1,
        exported: new Date().toISOString(),
        settings: TB.persist.get(KEYS.settings, null),
        profiles: TB.persist.get(KEYS.profiles, { schemaVersion: 1, items: [] })
      };
    },

    importWorkspace: function (obj) {
      if (!obj || obj.trexbWorkspace !== 1) {
        return { ok: false, error: 'Not a TRex Builder workspace file.' };
      }
      if (obj.settings) {
        var r1 = TB.persist.set(KEYS.settings, obj.settings);
        if (!r1.ok) { return r1; }
      }
      if (obj.profiles) {
        var r2 = TB.persist.set(KEYS.profiles, obj.profiles);
        if (!r2.ok) { return r2; }
      }
      return { ok: true };
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
