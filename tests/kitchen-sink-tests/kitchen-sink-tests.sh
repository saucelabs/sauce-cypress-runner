#!/bin/bash

export SAUCE_USERNAME=''
export SAUCE_ACCESS_KEY='' 
export SAUCE_ROOT_DIR=$PWD/tests/kitchen-sink-tests 
export SAUCE_REPORTS_DIR=$SAUCE_ROOT_DIR/'__assets__'
sudo chown -R $USER:$(id -gn $USER) $SAUCE_ROOT_DIR 
sudo mkdir -p $SAUCE_REPORTS_DIR && sudo chown -R $USER:$(id -gn $USER) $SAUCE_REPORTS_DIR
cd $SAUCE_ROOT_DIR && \
  echo '{"fixturesFolder":"./cypress/fixtures"}' > cypress.json && \
  saucectl run
