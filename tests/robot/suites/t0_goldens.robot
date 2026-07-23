*** Settings ***
Documentation     T0 - generator goldens.
...
...               Wraps the app's existing self-test page (tests.html): 103
...               golden / structural / warning / round-trip tests that assert
...               the generators emit exactly the expected bytes. Those tests
...               are the app's fast inner loop and are NOT reimplemented here -
...               this suite runs the page in a real browser and reports its
...               machine-readable result (window.__TB_TESTS) into the Robot log,
...               so tier 0 shows up in the same report as every other tier.
...
...               A failure here means a generator changed its output. That is
...               only ever acceptable when a release intended it, in which case
...               the golden is updated in the same commit - never loosened.
Library           Browser
Variables         ../variables/env_common.py
Suite Setup       New Browser    ${BROWSER_TYPE}    headless=${BROWSER_HEADLESS}
Suite Teardown    Close Browser    ALL
Force Tags        t0    nolab

*** Variables ***
${RESULT_TIMEOUT}     60s

*** Test Cases ***
All Generator Self Tests Pass
    [Documentation]    Loads tests.html, waits for the suite to finish, and fails
    ...                with the names of any failing tests. The count is also
    ...                asserted to be non-zero, so a page that silently registers
    ...                no tests cannot masquerade as a pass.
    [Tags]    goldens
    ${result}=    Run Self Test Page
    Log    Ran ${result}[total] generator tests in ${result}[elapsedMs] ms    console=True
    Should Be True    ${result}[total] > 0
    ...    tests.html registered no tests at all - the page or its script order is broken
    ${failed}=    Evaluate    ${result}[total] - ${result}[passed]
    Run Keyword If    ${failed} > 0
    ...    Fail    ${failed} of ${result}[total] generator tests FAILED -> ${result}[failures]

Self Test Count Has Not Shrunk
    [Documentation]    Guards against tests being deleted rather than fixed. The
    ...                expected count is a floor, not an equality - adding tests
    ...                is always fine, and this is raised when a release adds
    ...                them. Documented in the plan as a T0 non-regression gate.
    [Tags]    goldens    regression
    ${result}=    Run Self Test Page
    Should Be True    ${result}[total] >= ${EXPECTED_MIN_TESTS}
    ...    tests.html now registers only ${result}[total] tests, down from the expected ${EXPECTED_MIN_TESTS} - were tests deleted instead of fixed?

*** Keywords ***
Run Self Test Page
    [Documentation]    Opens tests.html from disk and returns the __TB_TESTS blob.
    ...                The page sets that global last, so polling for it to exist
    ...                is also how we know the async run chain has finished.
    New Page    ${TESTS_PAGE_URL}
    Wait Until Keyword Succeeds    ${RESULT_TIMEOUT}    1s    Self Tests Have Finished
    ${result}=    Evaluate JavaScript    ${None}    () => window.__TB_TESTS
    RETURN    ${result}

Self Tests Have Finished
    [Documentation]    Fails until tests.html publishes its result global. Retried
    ...                by the caller; a persistent failure means the run threw
    ...                before completing rather than that tests failed.
    ${done}=    Evaluate JavaScript    ${None}    () => !!window.__TB_TESTS
    Should Be True    ${done}    tests.html has not published window.__TB_TESTS yet
