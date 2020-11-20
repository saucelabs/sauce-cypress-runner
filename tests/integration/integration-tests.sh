export SAUCE_USERNAME=''
export SAUCE_ACCESS_KEY=''
node . -r tests/config-tests/sauce-runner.json -s "default"
node . -r tests/env-tests/sauce-runner.json -s "default"
