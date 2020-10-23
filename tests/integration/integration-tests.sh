export SAUCE_USERNAME=''
export SAUCE_ACCESS_KEY=''
export SAUCE_CYPRESS_VIDEO_RECORDING=false
export CONFIG_FILE=./tests/config-tests/config.yaml && node .
export CONFIG_FILE=./tests/env-tests/config.yaml && node .
