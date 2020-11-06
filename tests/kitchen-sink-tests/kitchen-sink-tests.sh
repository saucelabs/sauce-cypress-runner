#!/bin/bash

export SAUCE_USERNAME=''
export SAUCE_ACCESS_KEY='' 
export SAUCE_REPORTS_DIR=$PWD/'__assets__'
export SAUCE_ROOT_DIR=$PWD/tests/kitchen-sink-tests && \
  cd $SAUCE_ROOT_DIR && \
  sudo touch console.log && sudo chown $USER:$(id -gn $USER) console.log && \
  saucectl run
