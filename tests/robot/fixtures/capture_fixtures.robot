*** Settings ***
Documentation     MAINTENANCE TASK - not part of any tier. Regenerates
...               tests/robot/fixtures/models.json.
...
...               The T1 tier needs realistic builder models to generate from.
...               Rather than hand-write them (which drifts from the app and is
...               nobody's idea of a good time to review), they are captured
...               from tests.html, whose fixtures are already pinned by goldens
...               and were validated at authoring time through stl-sim/astf-sim.
...               That makes the committed models.json a derived artifact with a
...               known-good provenance rather than a second source of truth.
...
...               Re-run when the app's fixtures change:
...                 robot --variablefile tests/robot/variables/env_common.py \
...                       tests/robot/fixtures/capture_fixtures.robot
...               ...then review the models.json diff before committing it.
Library           Browser
Library           OperatingSystem
Library           Collections
Variables         ../variables/env_common.py
Force Tags        maintenance    nolab

*** Test Cases ***
Capture Fixture Models From The Self Test Page
    [Documentation]    Loads tests.html, harvests every fixture model it defines,
    ...                and writes them to models.json sorted by key so the diff
    ...                is stable between runs.
    New Browser    ${BROWSER_TYPE}    headless=${BROWSER_HEADLESS}
    New Page    ${TESTS_PAGE_URL}
    Wait Until Keyword Succeeds    60s    1s    Page Has Run Its Tests
    ${models}=    Evaluate JavaScript    ${None}    ${CAPTURE_JS}
    ${count}=     Get Length    ${models}
    Should Be True    ${count} >= 30
    ...    only ${count} fixtures captured - tests.html fixture names may have changed, check CAPTURE_JS
    ${json}=    Evaluate    json.dumps($models, indent=2, sort_keys=True)    modules=json
    Create File    ${FIXTURES}${/}models.json    ${json}
    Log    Captured ${count} fixture models to ${FIXTURES}${/}models.json    console=True
    [Teardown]    Close Browser    ALL

*** Keywords ***
Page Has Run Its Tests
    ${done}=    Evaluate JavaScript    ${None}    () => !!window.__TB_TESTS
    Should Be True    ${done}    tests.html has not finished running

*** Variables ***
${CAPTURE_JS}     SEPARATOR=\n
...    () => {
...      const o = {};
...      // every fx* model fixture (stl, astf, emu, tpg, bird)
...      Object.keys(window).filter(k => /^fx/.test(k) && window[k] && window[k].kind)
...        .forEach(k => { o[k] = window[k]; });
...      // cap2 / cli / cfg fixtures come from factories, so name them explicitly
...      o.cap2Dns = window.cap2Model('dns_like', {});
...      o.cap2DynPyload = window.cap2Model('dyn_pyload_like', { capInfo: [{
...        name: 'avl/delay_10_http_browsing_0.pcap', cps: 2.776, ipg: 10000, rtt: 10000,
...        w: 1, limit: null, plugin_id: null,
...        dynPyload: [{ pkt_id: 1, pyld_offset: 4, type: 1, len: 4 }] }] });
...      o.cliAstf = window.cliModel({ astfClientMask: '0x1' });
...      o.cliStl = window.cliModel({ mode: 'stl', profile: 'imix.py', mult: 1 });
...      o.cliCapture = window.cliModel({ service: window.svcModel({
...        ports: '0,1', capture: 'record', rx: '0 1', tx: '0', limit: 500,
...        bpf: 'udp port 53', snaplen: 128, outFile: '/tmp/dns.pcap' }) });
...      o.cfgServerIp = window.srvIp();
...      o.cfgServerMac = window.srvMac();
...      o.cfgServerBig = window.srvBig();
...      return o;
...    }
