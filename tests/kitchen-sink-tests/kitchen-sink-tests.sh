#!/bin/bash

export SAUCE_USERNAME=''
export SAUCE_ACCESS_KEY='' 
export WORKING_DIR=$PWD/tests/kitchen-sink-tests 
export WORKING_RPT_DIR=$WORKING_DIR/'__assets__'
cd $WORKING_DIR && \
  saucectl run --verbose
