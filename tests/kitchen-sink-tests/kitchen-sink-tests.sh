#!/bin/bash

export SAUCE_USERNAME=''
export SAUCE_ACCESS_KEY='' 
export SAUCE_REPORTS_DIR=$PWD/'__assets__'
export SAUCE_ROOT_DIR=$PWD/tests/kitchen-sink-tests && \
  echo '{"fixturesFolder":"tests/kitchen-sink-tests/cypress/fixtures"}' > cypress.json && \
  node .
