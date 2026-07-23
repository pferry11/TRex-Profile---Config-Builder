*** Settings ***
Documentation     T1 - static artifact validity.
...
...               Generates every committed fixture model through the app's real
...               generators (in Node, no browser and no server) and proves each
...               artifact is well-formed input for whatever consumes it:
...               Python compiles, YAML and JSON parse, BIRD braces balance,
...               launch scripts have a shebang and a t-rex-64 call.
...
...               This is the tier the golden tests cannot cover. A golden proves
...               the output did not CHANGE; T1 proves the output is VALID. Both
...               can disagree - a carelessly updated golden pins broken bytes.
...
...               Runs in seconds and needs no lab, so it should stay green at
...               all times and gates every later tier.
Library           OperatingSystem
Library           Collections
Library           Process
Library           ../libraries/ArtifactValidator.py
Variables         ../variables/env_common.py
Suite Setup       Generate All Artifacts
Force Tags        t1    nolab    static

*** Variables ***
${OUT_DIR}        ${WORKSPACE}${/}t1

*** Test Cases ***
Every Fixture Generates Without Error
    [Documentation]    The generation step itself is a test: a generator that
    ...                throws, or emits no files, fails here with the fixture
    ...                name rather than surfacing as a confusing downstream error.
    Should Be Empty    ${MANIFEST}[errors]
    ...    generators reported errors: ${MANIFEST}[errors]
    Should Be True    ${MANIFEST}[count] >= ${MANIFEST}[fixtures]
    ...    ${MANIFEST}[fixtures] fixtures produced only ${MANIFEST}[count] files
    Log    ${MANIFEST}[count] artifacts from ${MANIFEST}[fixtures] fixtures    console=True

No Artifact Is A Stub
    [Documentation]    Guards against a generator silently emitting a header and
    ...                nothing else - which compiles, parses, and is useless.
    FOR    ${a}    IN    @{MANIFEST}[artifacts]
        Artifact Is Not Empty    ${a}[path]
    END

Generated Python Profiles Compile
    [Documentation]    STL, ASTF and EMU .py artifacts must be syntactically
    ...                valid Python. Catches quoting and indentation defects in
    ...                the generated field engine / program blocks.
    ${py}=    Artifacts With Extension    .py
    Should Not Be Empty    ${py}
    FOR    ${a}    IN    @{py}
        Python Artifact Compiles    ${a}[path]
    END
    Log    ${py.__len__()} Python artifacts compiled    console=True

Generated Profiles Expose register()
    [Documentation]    TRex loads a profile module by calling register(). The
    ...                EMU/topo companion files are excluded - they are imported
    ...                by the profile, not loaded by TRex directly.
    ${py}=    Artifacts With Extension    .py
    FOR    ${a}    IN    @{py}
        Continue For Loop If    'emu' in '${a}[kind]'
        Continue For Loop If    '_topo' in '${a}[file]'
        Python Artifact Defines Register    ${a}[path]
    END

cap2 Profiles Are Valid YAML With The Required Shape
    [Documentation]    Single-element list carrying generator + a non-empty
    ...                cap_info - the shape TRex's STF loader expects.
    ${y}=    Artifacts Of Kind    cap2
    Should Not Be Empty    ${y}
    FOR    ${a}    IN    @{y}
        Cap2 Yaml Has Required Shape    ${a}[path]
    END

Platform Configs Are Valid YAML And Self Consistent
    [Documentation]    Also asserts port_limit agrees with the interface count -
    ...                a mismatch is the classic reason TRex refuses to start,
    ...                and it is invisible to a golden diff.
    ${y}=    Artifacts Of Kind    cfg
    Should Not Be Empty    ${y}
    FOR    ${a}    IN    @{y}
        Trex Cfg Has Required Shape    ${a}[path]
    END

TPG Tags Files Are Valid JSON With The Required Shape
    ${j}=    Artifacts With Extension    .json
    Should Not Be Empty    ${j}
    FOR    ${a}    IN    @{j}
        Tpg Tags Have Required Shape    ${a}[path]
    END

BIRD Configs Are Balanced And Have A Router ID
    ${c}=    Artifacts With Extension    .conf
    Should Not Be Empty    ${c}
    FOR    ${a}    IN    @{c}
        Bird Conf Is Balanced    ${a}[path]
    END

Generated Launch Scripts Look Runnable
    [Documentation]    Shebang plus a real t-rex-64 invocation. Tier 3 runs
    ...                `bash -n` on the box for a true syntax check.
    ${sh}=    Artifacts With Extension    .sh
    Should Not Be Empty    ${sh}
    FOR    ${a}    IN    @{sh}
        Shell Script Looks Runnable    ${a}[path]
    END

Every Profile Artifact Carries A Non Empty Summary
    [Documentation]    The '# Summary:' block is the only plain-English
    ...                explanation that travels with the file to the box. A
    ...                missing or empty summary is a real defect, not cosmetic.
    ...
    ...                Scoped to formats that HAVE a comment syntax (.py, .yaml,
    ...                .conf). The TPG tags file is JSON, which has none, so it
    ...                carries its summary in the companion runbook instead -
    ...                that is correct behaviour, not a gap. Runbooks and console
    ...                blocks (.txt) are excluded because they are already prose.
    ${checked}=    Set Variable    ${0}
    FOR    ${a}    IN    @{MANIFEST}[artifacts]
        Continue For Loop If    '${a}[kind]' == 'cli'
        Continue For Loop If    '_topo' in '${a}[file]'
        Continue For Loop If    not '${a}[file]'.endswith(('.py', '.yaml', '.conf'))
        Artifact Has Summary Block    ${a}[path]
        ${checked}=    Evaluate    ${checked} + 1
    END
    Should Be True    ${checked} > 0    no artifacts were checked - the filters exclude everything
    Log    ${checked} artifacts carry a summary    console=True

*** Keywords ***
Generate All Artifacts
    [Documentation]    Runs the Node generation harness once for the whole suite
    ...                and parses its JSON manifest into ${MANIFEST}.
    Remove Directory    ${OUT_DIR}    recursive=True
    Create Directory    ${OUT_DIR}
    ${res}=    Run Process    node
    ...    ${ROBOT_ROOT}${/}libraries${/}generate_artifacts.js
    ...    ${REPO_ROOT}    ${FIXTURES}${/}models.json    ${OUT_DIR}
    ...    stderr=STDOUT
    Should Be Equal As Integers    ${res.rc}    0
    ...    artifact generation failed:\n${res.stdout}
    ${last}=    Set Variable    ${res.stdout.strip().splitlines()[-1]}
    ${manifest}=    Evaluate    json.loads(r'''${last}''')    modules=json
    Set Suite Variable    ${MANIFEST}    ${manifest}

Artifacts With Extension
    [Arguments]    ${ext}
    ${out}=    Evaluate    [a for a in $MANIFEST['artifacts'] if a['file'].endswith('${ext}')]
    RETURN    ${out}

Artifacts Of Kind
    [Arguments]    ${kind}
    ${out}=    Evaluate    [a for a in $MANIFEST['artifacts'] if a['kind'] == '${kind}']
    RETURN    ${out}
