#!/bin/bash

export SAUCE_USERNAME=''
export SAUCE_ACCESS_KEY='' 
cd $PWD/tests/kitchen-sink-tests && \
  saucectl run --verbose
