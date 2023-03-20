export SAUCE_USERNAME=''
export SAUCE_ACCESS_KEY=''
export TEST_VALUE='Some test value'

node . -r tests/integration/config-tests/sauce-runner.json -s "default"
node . -r tests/integration/config-tests/sauce-runner.json -s "webkit"

node . -r tests/integration/env-tests/sauce-runner.json -s "default"
