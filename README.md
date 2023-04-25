Sauce Cypress Runner
====================

Sauce Labs test runner image for [`saucectl`](https://github.com/saucelabs/saucectl) to run [Cypress](https://www.cypress.io/) tests using [saucectl](https://docs.saucelabs.com/dev/cli/saucectl/). This repository contains the code that is being executed in Sauce Labs when running `saucectl run`.

If you are interested to contribute to this project, please have a look into our [contribution guidelines](https://github.com/saucelabs/sauce-cypress-runner/blob/main/CONTRIBUTING.md).

## Run Tests

### Integration tests
`npm run test-integration` triggers the [integration tests script](/tests/integration/integration-tests.sh). Which triggers the tests in (/tests/integration/fixtures/cypress-tests) and runs them through `cypress-runner.js`.

### Env Variables
#### `SAUCE_CYPRESS_VIDEO_RECORDING`
This env variable is for controlling cypress native video recording.
`true`/`1` will enable cypress native video recording.
`false`/`0` will stop cypress native video recording.
```sh
saucectl run -e SAUCE_CYPRESS_VIDEO_RECORDING=true
```

### `BROWSER_NAME`
Name of the browser to run the test on

#### `SAUCE_BROWSER_PATH`
Points to the browser binary path
