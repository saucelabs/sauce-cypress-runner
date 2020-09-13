#!/bin/bash
for FILE in $(find ./tests/fixtures/sauce-configs -type f -print); do 
    echo "Running 'npx saucectl run $FILE'"
    npx saucectl run --config $FILE; 
done