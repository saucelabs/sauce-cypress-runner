# CONTRIBUTING

## Run tests

### Integration tests
`npm run test-integration` triggers the [integration tests script](/tests/integration/integration-tests.sh). Which triggers the tests in (/tests/integration/fixtures/cypress-tests) and runs them through `cypress-runner.js`.

## Publishing to Docker Hub
To publish the Docker image:
* Create a [new release](https://github.com/saucelabs/sauce-cypress-runner/releases)
* Tag it with an appropriate version, based on semantic versioning
* Update the changelog and list the frameworks and browsers. If the frameworks and browsers didn't change, then copy and paste them from the previous release
