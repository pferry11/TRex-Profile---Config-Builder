/* TRex Profile & Config Builder - tiny regex syntax highlighter (python/yaml/shell).
 * Input is escaped for &, < and > only (quotes preserved) then wrapped in spans. */
(function (root) {
  'use strict';
  var TB = root.TB = root.TB || {};
  TB.ui = TB.ui || {};

  var PY_KEYWORDS = 'def|class|return|import|from|None|True|False|for|in|if|elif|else|not|and|or|while|break|continue|pass|lambda|with|as';

  var LANGS = {
    python: {
      // order matters: strings before comments so '#' inside a string stays a string
      re: new RegExp(
        '("(?:[^"\\\\\\n]|\\\\.)*"|\'(?:[^\'\\\\\\n]|\\\\.)*\')' + // 1 string
        '|(#[^\\n]*)' +                                            // 2 comment
        '|\\b(' + PY_KEYWORDS + ')\\b' +                           // 3 keyword
        '|\\b(\\d+(?:\\.\\d+)?)\\b', 'g'),                         // 4 number
      classes: ['str', 'com', 'kw', 'num']
    },
    yaml: {
      re: new RegExp(
        '("(?:[^"\\\\\\n]|\\\\.)*"|\'[^\'\\n]*\')' +               // 1 string
        '|(#[^\\n]*)' +                                            // 2 comment
        '|(^[ \\t]*-?[ \\t]*[\\w.-]+(?=[ \\t]*:))' +               // 3 key
        '|\\b(\\d+(?:\\.\\d+)?|true|false)\\b', 'gm'),             // 4 number/bool
      classes: ['str', 'com', 'kw', 'num']
    },
    shell: {
      re: new RegExp(
        '("[^"\\n]*"|\'[^\'\\n]*\')' +                             // 1 string
        '|(#[^\\n]*)' +                                            // 2 comment
        '|(\\s--?[\\w-]+)', 'g'),                                  // 3 flag
      classes: ['str', 'com', 'kw']
    },
    json: {
      re: new RegExp(
        '("(?:[^"\\\\\\n]|\\\\.)*")' +                             // 1 string
        '|\\b(\\d+(?:\\.\\d+)?|true|false|null)\\b', 'g'),         // 2 number/literal
      classes: ['str', 'num']
    }
  };

  TB.ui.highlight = function (code, language) {
    var esc = TB.util.escapeHtml(code);
    var lang = LANGS[language];
    if (!lang) { return esc; }
    return esc.replace(lang.re, function () {
      var groups = Array.prototype.slice.call(arguments, 1, 1 + lang.classes.length);
      for (var i = 0; i < groups.length; i++) {
        if (groups[i] !== undefined) {
          return '<span class="hl-' + lang.classes[i] + '">' + groups[i] + '</span>';
        }
      }
      return arguments[0];
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
