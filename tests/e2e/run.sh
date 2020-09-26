set -e
npx tsc -p ./tests/fixtures/typescript/tsconfig.json
for folder in ./tests/fixtures/*/
do
    pushd $folder
    echo Running $folder
    $SAUCE_CTL_BINARY run --config ./.sauce/config.yml
    popd
done