#!/bin/bash

export SAUCE_USERNAME=''
export SAUCE_ACCESS_KEY='' 
export SAUCE_REPORTS_DIR=$PWD/'__assets__'
export SAUCE_ROOT_DIR=$PWD/tests/kitchen-sink-tests
npm install saucectl && \
  export PATH=$PATH:$PWD/node_modules/.bin && \
  cd $SAUCE_ROOT_DIR && \
  saucectl run

