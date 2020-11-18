export SAUCE_USERNAME=''
export SAUCE_ACCESS_KEY=''
pushd tests/config-tests/ && node ../../ -r sauce-runner.json -s "default" && popd
pushd tests/env-tests/ && node ../../ -r sauce-runner.json -s "default" && popd
