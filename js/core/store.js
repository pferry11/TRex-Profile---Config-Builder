/* TRex Profile & Config Builder - minimal pub/sub state container. */
(function (root) {
  'use strict';
  var TB = root.TB = root.TB || {};

  TB.store = {
    create: function (initial) {
      var data = initial;
      var subs = [];
      return {
        get: function () { return data; },
        set: function (next) {
          data = next;
          for (var i = 0; i < subs.length; i++) { subs[i](data); }
        },
        // Notify subscribers after in-place mutation of the current value.
        touch: function () { this.set(data); },
        subscribe: function (fn) {
          subs.push(fn);
          return function () {
            var i = subs.indexOf(fn);
            if (i >= 0) { subs.splice(i, 1); }
          };
        }
      };
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
