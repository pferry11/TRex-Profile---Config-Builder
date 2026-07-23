*** Settings ***
Documentation     T2 - import / round-trip fidelity.
...
...               Two guarantees, both of which the app makes in its README and
...               neither of which anything enforced before this suite:
...
...               1. RE-IMPORT COVERAGE over the shipped v3.06 corpus does not
...                  regress. The three coverage tools already measured it; this
...                  turns their documented figures into gates by running them
...                  with --json --min-full, so a parser change that quietly
...                  drops files fails the build instead of a README.
...
...               2. ROUND-TRIP: a profile this tool generated re-imports and
...                  regenerates byte-identically ("the body is the source of
...                  truth"). Checked for every committed fixture, per format.
...
...               Needs a local v3.06/ tree (intentionally not committed - see
...               README). The corpus tests skip with a clear message when it is
...               absent, so the tier still runs on a machine without it; the
...               round-trip tests never need it.
Library           Process
Library           OperatingSystem
Library           Collections
Variables         ../variables/env_common.py
Suite Setup       Check For The v3 06 Corpus
Force Tags        t2    nolab    fidelity

*** Variables ***
${CORPUS_HELP}    needs a local v3.06/ tree - see the README (intentionally not committed)

*** Test Cases ***
cap2 Import Coverage Has Not Regressed
    [Documentation]    All 67 shipped cap2/avl profiles must keep mapping at
    ...                100%. This is the one corpus that is fully solved, so any
    ...                drop at all is a regression - the gate equals the total.
    [Tags]    corpus
    ${r}=    Run Coverage Tool    cap2_import_coverage.js    ${CAP2_MIN_FULL}
    Should Be Equal As Integers    ${r}[full]    ${r}[total]
    ...    cap2 should map every shipped profile: ${r}[full] of ${r}[total]

STL Offline Import Coverage Has Not Regressed
    [Documentation]    Shipped STL profiles are arbitrary Python, so the offline
    ...                parser is best-effort by design. The gate is the floor
    ...                documented in the README, not the total - full corpus
    ...                coverage is the backend resolver's job, not the parser's.
    [Tags]    corpus
    ${r}=    Run Coverage Tool    stl_import_coverage.js    ${STL_MIN_FULL}
    Log    STL: ${r}[full] full / ${r}[partial] partial / ${r}[failed] failed of ${r}[total]    console=True

ASTF Offline Import Coverage Has Not Regressed
    [Documentation]    Same contract as STL. Shipped ASTF files are largely
    ...                structural, so the floor is much higher.
    [Tags]    corpus
    ${r}=    Run Coverage Tool    astf_import_coverage.js    ${ASTF_MIN_FULL}
    Log    ASTF: ${r}[full] full / ${r}[partial] partial / ${r}[failed] failed of ${r}[total]    console=True

Generated Profiles Round Trip Byte Identically
    [Documentation]    generate -> TB.imp.parse -> regenerate -> compare, for
    ...                every fixture in an importable format (stl, astf, cap2).
    ...                Also asserts each re-import reports coverage 1.0: a
    ...                tool-generated file that maps at less than 100% means a
    ...                field is emitted that no reader reverses.
    ...
    ...                Generate-only formats (cfg, cli, emu, tpg, bird) have no
    ...                importer and are reported as skipped, not silently passed.
    ${res}=    Run Process    node
    ...    ${ROBOT_ROOT}${/}libraries${/}roundtrip_check.js
    ...    ${REPO_ROOT}    ${FIXTURES}${/}models.json
    ...    stderr=STDOUT
    ${r}=    Parse Last Json Line    ${res.stdout}
    Should Be Empty    ${r}[failures]    round-trip failures: ${r}[failures]
    Should Be True    ${r}[checked] > 0    no fixtures were round-tripped at all
    Log    ${r}[checked] fixtures round-tripped; ${r}[skipped] generate-only formats skipped    console=True

Known Round Trip Limitations Are Still Accurate
    [Documentation]    The round-trip checker carries a short list of documented,
    ...                intentional gaps (currently: the GTP-U companion _topo.py
    ...                is not re-imported). This test fails if one of them starts
    ...                working - so the list gets deleted when the app improves
    ...                instead of quietly becoming a permanent excuse.
    ${res}=    Run Process    node
    ...    ${ROBOT_ROOT}${/}libraries${/}roundtrip_check.js
    ...    ${REPO_ROOT}    ${FIXTURES}${/}models.json
    ...    stderr=STDOUT
    ${r}=    Parse Last Json Line    ${res.stdout}
    Should Be Empty    ${r}[knownNowFixed]
    ...    these now round-trip cleanly - remove them from KNOWN_LIMITATIONS in roundtrip_check.js: ${r}[knownNowFixed]
    FOR    ${k}    IN    @{r}[knownStillBroken]
        Log    KNOWN LIMITATION - ${k}[fixture]: ${k}[reason]    level=WARN
    END

*** Keywords ***
Check For The v3 06 Corpus
    [Documentation]    The corpus tests need the uncommitted v3.06 tree. Record
    ...                its presence once so each test can skip with a useful
    ...                message rather than failing obscurely.
    ${exists}=    Run Keyword And Return Status    Directory Should Exist    ${REPO_ROOT}${/}v3.06
    Set Suite Variable    ${HAVE_CORPUS}    ${exists}
    Run Keyword If    not ${exists}    Log
    ...    v3.06/ tree not found - corpus coverage tests will skip    level=WARN

Run Coverage Tool
    [Documentation]    Runs one coverage tool with --json --min-full N. A
    ...                non-zero exit is the gate firing; the JSON carries the
    ...                numbers for the log.
    [Arguments]    ${tool}    ${min_full}
    Skip If    not ${HAVE_CORPUS}    ${tool} ${CORPUS_HELP}
    ${res}=    Run Process    node    ${REPO_ROOT}${/}tools${/}${tool}
    ...    ${REPO_ROOT}    --json    --min-full    ${min_full}
    ${r}=    Parse Last Json Line    ${res.stdout}
    Should Be Equal As Integers    ${res.rc}    0
    ...    COVERAGE REGRESSION in ${tool}: ${r}[full] files map at 100%, below the required ${min_full}.\n${res.stderr}
    Should Be True    ${r}[ok]
    RETURN    ${r}

Parse Last Json Line
    [Documentation]    The Node tools print a human report first and the JSON
    ...                blob last - the same contract tools/stl_resolve.py uses
    ...                and app.py relies on (app.py:137).
    [Arguments]    ${stdout}
    ${last}=    Set Variable    ${stdout.strip().splitlines()[-1]}
    ${parsed}=    Evaluate    json.loads(r'''${last}''')    modules=json
    RETURN    ${parsed}
