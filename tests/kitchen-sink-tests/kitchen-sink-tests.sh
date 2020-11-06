#!/bin/bash

export SAUCE_USERNAME=''
export SAUCE_ACCESS_KEY='' 
export SAUCE_REPORTS_DIR=$PWD/'__assets__'
export SAUCE_ROOT_DIR=$PWD/tests/kitchen-sink-tests && \
  sudo chown -R $USER:$(id -gn $USER) $SAUCE_ROOT_DIR && \
  cd $SAUCE_ROOT_DIR && \
  saucectl run
