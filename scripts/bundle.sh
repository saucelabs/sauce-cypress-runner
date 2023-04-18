set -e
rm -rf ./bundle/
mkdir ./bundle/
export CYPRESS_CACHE_FOLDER=$PWD/bundle/Cache/
echo $CYPRESS_CACHE_FOLDER
cp -r ./src/ ./bundle/src/
cp -r bin/ bundle/bin/
cp package.json bundle/package.json
cp package-lock.json bundle/package-lock.json
cp tsconfig.json bundle/tsconfig.json
cp "$(which node)" bundle/

pushd bundle/
npm cache clean --force
PLAYWRIGHT_BROWSERS_PATH=0 npm ci --production
PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install-deps webkit
npm run build
./node ./node_modules/cypress/bin/cypress verify
# TODO: Add "saucectl" tests here
popd
