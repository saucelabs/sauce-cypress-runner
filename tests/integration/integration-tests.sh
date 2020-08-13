export SAUCE_USERNAME=''
export SAUCE_ACCESS_KEY=''
export CONFIG_FILE=./tests/fixtures/cypress-tests/config-tests/config.yaml && node .
export CONFIG_FILE=./tests/fixtures/cypress-tests/kitchen-sink/config.yaml && node .
export CONFIG_FILE=./tests/fixtures/cypress-tests/typescript-tests/config.yaml && node .
export CONFIG_FILE=./tests/fixtures/cypress-tests/typescript-no-config-tests/config.yaml && node .