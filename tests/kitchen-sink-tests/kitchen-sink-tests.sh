#!/bin/bash

export SAUCE_USERNAME=''
export SAUCE_ACCESS_KEY='' 
export WORKING_DIR=$PWD/tests/kitchen-sink-tests 
export WORKING_RPT_DIR=$WORKING_DIR/'__assets__'
sudo chown -R $USER:$(id -gn $USER) $WORKING_DIR 
sudo mkdir -p $WORKING_RPT_DIR && sudo chown -R $USER:$(id -gn $USER) $WORKING_RPT_DIR
cd $WORKING_DIR && \
  saucectl run --verbose
