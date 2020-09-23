set -e
rm -rf ./bundle/
mkdir ./bundle/
export CYPRESS_CACHE_FOLDER=$PWD/bundle/Cache/
echo $CYPRESS_CACHE_FOLDER
npm ci --production
cp -r ./node_modules/ ./bundle/node_modules/
cp -r ./src/ ./bundle/src/
cp -r bin/ bundle/bin/
cp package.json bundle/package.json
cp config.yaml bundle/config.yaml
cp cypress.json bundle/cypress.json
cp "$(which node)" bundle/

pushd bundle/
./node ./node_modules/cypress/bin/cypress verify
# TODO: Add "saucectl" tests here
popd