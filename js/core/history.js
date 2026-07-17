/* TRex Profile & Config Builder - undo/redo history for builder models.
 * A bounded stack of JSON snapshots. Builders call record(model) from their
 * (debounced) regen, so one entry lands per settled edit; identical
 * consecutive states dedupe, and editing after an undo truncates the redo
 * branch - standard editor semantics. Pure (no DOM), so the test suite can
 * drive it directly. */
(function (root) {
  'use strict';
  var TB = root.TB = root.TB || {};

  TB.history = {
    create: function (opts) {
      opts = opts || {};
      var limit = opts.limit || 50;
      var stack = [];
      var ptr = -1;
      var listeners = [];

      function emit() {
        for (var i = 0; i < listeners.length; i++) { listeners[i](); }
      }

      return {
        /* Snapshot the model. No-op when it matches the current position
         * (e.g. the regen that follows an undo). Returns true if pushed. */
        record: function (model) {
          var raw = JSON.stringify(model);
          if (ptr >= 0 && stack[ptr] === raw) { return false; }
          stack = stack.slice(0, ptr + 1);
          stack.push(raw);
          if (stack.length > limit) { stack.shift(); }
          ptr = stack.length - 1;
          emit();
          return true;
        },

        /* Both return a fresh deep clone, or null at the end of the stack. */
        undo: function () {
          if (ptr <= 0) { return null; }
          ptr -= 1;
          emit();
          return JSON.parse(stack[ptr]);
        },
        redo: function () {
          if (ptr >= stack.length - 1) { return null; }
          ptr += 1;
          emit();
          return JSON.parse(stack[ptr]);
        },

        canUndo: function () { return ptr > 0; },
        canRedo: function () { return ptr < stack.length - 1; },
        depth: function () { return stack.length; },

        /* Called after every record/undo/redo - the topbar buttons subscribe. */
        onChange: function (fn) { listeners.push(fn); }
      };
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
