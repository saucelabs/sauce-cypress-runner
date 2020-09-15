for file in ./tests/e2e/*.yml
do
    echo $file
    ./saucectl/saucectl run --config  $file
done