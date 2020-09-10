Sauce Cypress Runner
====================

Sauce Labs test runner image for [`saucectl`](https://github.com/saucelabs/saucectl) to run [Cypress](https://www.cypress.io/) tests using [Sauce Labs Testrunner Toolkit](https://opensource.saucelabs.com/testrunner-toolkit/docs/overview.html). This repository contains the code that is being executed in the container when running a test with `saucectl` in your pipeline or on Sauce Labs.

If you are interested to contribute to this project, please have a look into our [contribution guidelines](https://github.com/saucelabs/sauce-cypress-runner/blob/main/CONTRIBUTING.md).

## Requirements

To work on code the following dependencies are required:

- Docker

## Install

You can pull the latest version of this image via:

```sh
$ docker pull saucelabs/stt-cypress-mocha-node:latest
```

## Run Tests

### Integration tests
`npm run test-integration` triggers the [integration tests script](/tests/integration/integration-tests.sh). Which triggers the tests in (/tests/integration/fixtures/cypress-tests) and runs them through `cypress-runner.js`.

## Publishing to Docker Hub
To publish the Docker image:
* Create a [new release](https://github.com/saucelabs/sauce-cypress-runner/releases)
* Tag it with an appropriate version, based on semantic versioning
* Update the changelog and list the frameworks and browsers. If the frameworks and browsers didn't change, then copy and paste them from the previous release