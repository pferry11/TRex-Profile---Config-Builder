/* TRex Profile & Config Builder - Tagged Packet Group (TPG) configuration
 * generator (TRex v3.06).
 *
 * Emits the tags-configuration JSON consumed by the console's tpg_enable
 * command (--tags file.json) plus a TPG_CONSOLE.txt runbook. The JSON is a
 * list where the INDEX of each entry is the tag id the rx stats are grouped
 * by: QinQ entries ({"type":"QinQ","value":{"vlans":[inner,outer]}}) and
 * Dot1Q entries ({"type":"Dot1Q","value":{"vlan":n}}), the same shapes as the
 * shipped stl/tpg_tags_conf.py and stl_tpg_stats.py examples.
 * Console flags verified against v3.06 parsing_opts.py: tpg_enable --ports
 * --num-tpgids --tags; tpg_stats --port --tpgid --min-tag --max-tag.
 * Registered as TB.gen.registry["3.06"].tpg.
 */
(function (root) {
  'use strict';
  var TB = root.TB = root.TB || {};
  TB.gen = TB.gen || {};

  var MIN_VLAN = 1, MAX_VLAN = 4094; /* 12-bit vlan id, 0 and 4095 reserved */

  function set(v) { return v !== null && v !== undefined && v !== ''; }

  function collectWarnings(model) {
    var w = [];
    var seen = {};
    (model.qinq || []).forEach(function (q, i) {
      [['inner', q.inner], ['outer', q.outer]].forEach(function (p) {
        if (!set(p[1]) || p[1] < MIN_VLAN || p[1] > MAX_VLAN) {
          w.push('QinQ pair ' + (i + 1) + ': ' + p[0] + ' VLAN ' + p[1] + ' is outside ' + MIN_VLAN + '-' + MAX_VLAN + '.');
        }
      });
    });
    (model.dot1q || []).forEach(function (d, i) {
      if (!set(d.minVlan) || !set(d.maxVlan) || d.minVlan < MIN_VLAN || d.maxVlan > MAX_VLAN) {
        w.push('Dot1Q range ' + (i + 1) + ': VLANs must stay within ' + MIN_VLAN + '-' + MAX_VLAN + '.');
        return;
      }
      if (d.minVlan > d.maxVlan) {
        w.push('Dot1Q range ' + (i + 1) + ': min VLAN ' + d.minVlan + ' is above max VLAN ' + d.maxVlan + '.');
        return;
      }
      for (var v = d.minVlan; v <= d.maxVlan; v++) {
        if (seen[v]) {
          w.push('Dot1Q VLAN ' + v + ' appears in more than one range - each VLAN may map to only one tag id.');
          break;
        }
      }
      for (v = d.minVlan; v <= d.maxVlan; v++) { seen[v] = true; }
    });
    if (!(model.qinq || []).length && !(model.dot1q || []).length) {
      w.push('No tags defined - add a Dot1Q range or a QinQ pair.');
    }
    if (!set(model.numTpgids) || model.numTpgids <= 0) {
      w.push('num-tpgids must be positive: it is the upper bound of tpgid values your streams will use ' +
        '(each stream needs flow_stats=STLTaggedPktGroup(tpgid=i) with i below it).');
    }
    return w;
  }

  function generate(model, opts) {
    opts = opts || {};
    var warnings = collectWarnings(model);
    var name = (model.meta && model.meta.name) ? model.meta.name : 'tpg';
    var fileBase = name.replace(/[^\w.-]+/g, '_');
    var now = opts.now || TB.util.todayIso();
    var trexVersion = model.trexVersion || '3.06';

    /* ---- tags JSON: QinQ entries first, then Dot1Q ranges expanded ---- */
    var entries = [];
    (model.qinq || []).forEach(function (q) {
      entries.push('  { "type": "QinQ", "value": { "vlans": [' + q.inner + ', ' + q.outer + '] } }');
    });
    (model.dot1q || []).forEach(function (d) {
      if (!set(d.minVlan) || !set(d.maxVlan) || d.minVlan > d.maxVlan) { return; }
      for (var v = d.minVlan; v <= d.maxVlan; v++) {
        entries.push('  { "type": "Dot1Q", "value": { "vlan": ' + v + ' } }');
      }
    });
    var tagsJson = '[\n' + entries.join(',\n') + '\n]\n';
    var totalTags = entries.length;

    /* ---- console runbook ---- */
    var ports = set(model.ports) ? model.ports : '0 1';
    var num = set(model.numTpgids) ? model.numTpgids : 1;
    var maxTag = totalTags ? totalTags : 1;
    var consoleLines = [
      '# ' + new Array(78).join('-'),
      '# TRex Profile & Config Builder - Tagged Packet Group (TPG) runbook',
      '# Generated: ' + now + '   Target: TRex v' + trexVersion,
      '# TPG groups rx stats per VLAN tag: tag id = index in ' + fileBase + '_tpg_tags.json',
      '#   tag ids 0-' + (maxTag - 1) + ' -> ' + ((model.qinq || []).length ? (model.qinq || []).length + ' QinQ pair(s), then ' : '') +
        'Dot1Q VLANs in range order',
      '# ' + new Array(78).join('-'),
      '',
      '# TRex server must be up in interactive STL mode (see the CLI Builder tab):',
      '#   sudo ./t-rex-64 -i --stl',
      '',
      './trex-console',
      '',
      '# enable TPG on the rx ports with the tags file:',
      'trex>tpg_enable --ports ' + ports + ' --num-tpgids ' + num + ' --tags ' + fileBase + '_tpg_tags.json',
      'trex>tpg_status',
      '',
      '# start traffic whose streams carry flow_stats=STLTaggedPktGroup(tpgid=i)',
      '# with 0 <= i < ' + num + ' (see stl/tpg_1tag_stream.py for the pattern):',
      'trex>start -f <your_tpg_profile.py> -p 0',
      '',
      '# read per-tag rx stats (pkts/bytes/seq errors per VLAN tag):',
      'trex>tpg_stats --port 1 --tpgid 0 --min-tag 0 --max-tag ' + maxTag,
      '',
      '# when done:',
      'trex>tpg_disable',
      ''
    ];

    return {
      files: [
        { name: fileBase + '_tpg_tags.json', language: 'json', content: tagsJson },
        { name: 'TPG_CONSOLE.txt', language: 'shell', content: consoleLines.join('\n') }
      ],
      warnings: warnings,
      totalTags: totalTags
    };
  }

  TB.gen.register('3.06', 'tpg', generate);
})(typeof window !== 'undefined' ? window : globalThis);
