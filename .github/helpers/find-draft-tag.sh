#!/usr/bin/env bash

VERSION=$(curl -s -H "Authorization: token ${GITHUB_TOKEN}" \
            https://api.github.com/repos/${GITHUB_REPOSITORY}/releases | \
            jq -r "[.[] | select(.draft == true) | select(.body | contains(\"- jobId: ${GITHUB_RUN_ID}\\r\\n\"))] | first | .tag_name")
RELEASE_ID=$(curl -s -H "Authorization: token ${GITHUB_TOKEN}" \
            https://api.github.com/repos/${GITHUB_REPOSITORY}/releases | \
            jq -r "[.[] | select(.draft == true) | select(.body | contains(\"- jobId: ${GITHUB_RUN_ID}\\r\\n\"))] | first | .id")

if [ "${VERSION}" = "" ];then
    echo "No draft version found"
    exit 1
fi
echo ::set-output name=version::${VERSION}
echo ::set-output name=release_id::${RELEASE_ID}