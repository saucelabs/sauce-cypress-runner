rm -rf bundle/
mkdir bundle/
export CYPRESS_CACHE_FOLDER=bundle/Cache/
npm ci --production
cp -r node_modules/ bundle/node_modules/
cp -r src/ bundle/src/
cp -r package.json bundle/
cp -r bin/ bundle/bin/
cp config.yaml bundle/
cp cypress.json bundle/
cp $(which node) bundle/

pushd bundle/
./node ./node_modules/cypress/bin/cypress verify
# TODO: Add "saucectl" tests here
popd