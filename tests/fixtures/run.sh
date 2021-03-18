#!/usr/bin/env bash

test_commands() {
    EXIT_CODE=0
    for cmd in "$@";do
        if ! command -v ${cmd} &> /dev/null;then
            echo "${cmd} could not be found"
            EXIT_CODE=1
        fi
    done
    return ${EXIT_CODE}
}

run_test() {
    key=${1}
    result=${2}
    args=${3}
    echo "Running ${key} (expected: ${result})"

    tmpfile=$(mktemp)
    pushd ./tests/fixtures/${key}/ > /dev/null
    saucectl run -c .sauce/config.yml --test-env docker --ccy 1 ${args} > ${tmpfile} 2>&1
    RETURN_CODE=${?}
    popd > /dev/null

    echo "Result: ${RETURN_CODE}"
    if ([ "${result}" == "success" ] && [ "${RETURN_CODE}" -ne 0 ]) ||
         ([ "${result}" == "failure" ] && [ "${RETURN_CODE}" -eq 0 ]);then
        cat ${tmpfile}
        rm -f ${tmpfile}

        echo "TEST FAILURE: Result expected is ${result}, and exitCode is ${RETURN_CODE}" 
        return 1
    else
        # Display warning if there is some
        grep -E "(ERR|WRN)" ${tmpfile}
    fi
    rm -f ${tmpfile}
    echo ""
    return 0
}

# Test required commands
test_commands docker saucectl yq || exit 1

# build image
echo "Build docker images"
docker build -t saucelabs/stt-cypress-mocha-node:local . > /dev/null 2>&1

# suite=result
tests=(basic-js-rootdir-copy=success basic-js-rootdir-mount=success basic-js-no-rootdir-copy=success basic-js-no-rootdir-mount=success)

FAILURES=0
for i in ${tests[@]}; do
    key=$(echo ${i} | cut -d '=' -f 1)
    result=$(echo ${i} | cut -d '=' -f 2)

    run_test ${key} ${result}
    FAILURES=$((FAILURES+$?))
done

if [ ${FAILURES} -gt 0 ];then
    echo "Failed: ${FAILURES} failures occured."
    exit 1
fi
