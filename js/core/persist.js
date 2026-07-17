/* TRex Profile & Config Builder - workspace persistence, saved-profile
 * registry and workspace export/import.
 *
 * Backing store, best first:
 *   IndexedDB   - no practical size ceiling (pcap-heavy workspaces fit).
 *                 All keys load into an in-memory cache before boot
 *                 (TB.persist.ready), so get/set stay synchronous; writes go
 *                 through the cache and flush to IndexedDB asynchronously.
 *   localStorage - fallback when IndexedDB is unavailable (~5 MB cap).
 *                 Pre-IndexedDB workspaces migrate over on first run.
 *   memory      - last resort (storage disabled, Node tests); nothing persists.
 */
(function (root) {
  'use strict';
  var TB = root.TB = root.TB || {};

  var KEYS = {
    settings: 'trexb.settings.v1',
    profiles: 'trexb.profiles.v1',
    ui: 'trexb.ui.v1'
  };

  var memoryStore = {};
  var idb = null;      // IDBDatabase once open
  var cache = null;    // key -> raw JSON string; active only when idb is set

  function localGet(key) {
    try {
      if (root.localStorage) { return root.localStorage.getItem(key); }
    } catch (e) { /* fall through to memory */ }
    return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : null;
  }

  function localSet(key, value) {
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

  function storageGet(key) {
    if (cache) { return Object.prototype.hasOwnProperty.call(cache, key) ? cache[key] : null; }
    return localGet(key);
  }

  function storageSet(key, value) {
    if (cache) {
      cache[key] = value;
      idbWrite(key, value);
      return { ok: true };
    }
    return localSet(key, value);
  }

  function idbWrite(key, value) {
    try {
      var tx = idb.transaction('kv', 'readwrite');
      if (value === null) { tx.objectStore('kv')['delete'](key); }
      else { tx.objectStore('kv').put(value, key); }
      tx.onerror = function () {
        if (root.console) { root.console.warn('trexb: IndexedDB write failed for ' + key); }
      };
    } catch (e) {
      if (root.console) { root.console.warn('trexb: IndexedDB write threw: ' + e.message); }
    }
  }

  /* One-time copy of a pre-IndexedDB localStorage workspace into the cache/IDB.
   * localStorage values are left in place (harmless; IDB wins from now on). */
  function migrateFromLocal() {
    for (var k in KEYS) {
      if (!Object.prototype.hasOwnProperty.call(KEYS, k)) { continue; }
      var key = KEYS[k];
      if (cache[key] === undefined) {
        var v = localGet(key);
        if (v !== null) { cache[key] = v; idbWrite(key, v); }
      }
    }
  }

  /* Resolves once the backing store is decided (and, for IndexedDB, the cache
   * is loaded). Boot waits on this; get/set fall back to localStorage until then. */
  var ready = new Promise(function (resolve) {
    if (!root.indexedDB) { resolve(false); return; }
    var req;
    try { req = root.indexedDB.open('trexb', 1); }
    catch (e) { resolve(false); return; }
    req.onupgradeneeded = function (e) {
      var db = e.target.result;
      if (!db.objectStoreNames.contains('kv')) { db.createObjectStore('kv'); }
    };
    req.onerror = function () { resolve(false); };
    req.onblocked = function () { resolve(false); };
    req.onsuccess = function (e) {
      var db = e.target.result;
      var out = {};
      try {
        var cur = db.transaction('kv', 'readonly').objectStore('kv').openCursor();
        cur.onsuccess = function (ev) {
          var c = ev.target.result;
          if (c) { out[c.key] = c.value; c['continue'](); }
          else {
            idb = db;
            cache = out;
            migrateFromLocal();
            resolve(true);
          }
        };
        cur.onerror = function () { resolve(false); };
      } catch (e2) { resolve(false); }
    };
  });

  TB.persist = {
    KEYS: KEYS,
    ready: ready,

    /* 'indexeddb' | 'localstorage' | 'memory' - for the Settings tab readout */
    backendName: function () {
      if (idb) { return 'indexeddb'; }
      try { if (root.localStorage) { return 'localstorage'; } } catch (e) { /* fall through */ }
      return 'memory';
    },

    remove: function (key) {
      if (cache) {
        delete cache[key];
        idbWrite(key, null);
      }
      try { if (root.localStorage) { root.localStorage.removeItem(key); } } catch (e) { /* ignore */ }
      delete memoryStore[key];
    },

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
