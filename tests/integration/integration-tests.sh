export SAUCE_USERNAME=''
export SAUCE_ACCESS_KEY=''
export TEST_VALUE='Some test value'

node . -r tests/config-tests/sauce-runner.json -s "default"
node . -r tests/config-tests/sauce-runner.json -s "webkit"

node . -r tests/env-tests/sauce-runner.json -s "default"
