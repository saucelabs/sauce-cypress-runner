VERSION=${GITHUB_REF#refs/tags/}
CYPRESS_VERSION=`< package.json  jq -r '.dependencies["cypress"]'`
CYPRESS_VERSION_LOCKED=`jq < package-lock.json -r '.dependencies["cypress"].version'`
echo Comparing "${VERSION}" with "v${CYPRESS_VERSION}" and "v${CYPRESS_VERSION_LOCKED}"
if [[ "${VERSION}" != "v${CYPRESS_VERSION}"* ]] || [[ "${VERSION}" != "v${CYPRESS_VERSION_LOCKED}"* ]]; then
  echo "Release tag does not include the actual cypress version!"
  exit 1
fi
echo All clear!
