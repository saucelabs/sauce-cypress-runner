Sauce Cypress Runner
====================

Sauce Labs test runner image for [`saucectl`](https://github.com/saucelabs/saucectl) to run [Cypress](https://www.cypress.io/) tests using [saucectl](https://docs.saucelabs.com/dev/cli/saucectl/). This repository contains the code that is being executed in Sauce Labs when running `saucectl run`.

If you are interested to contribute to this project, please have a look into our [contribution guidelines](https://github.com/saucelabs/sauce-cypress-runner/blob/main/CONTRIBUTING.md).

## Run Tests

### Integration tests

`npm run test` triggers the [integration tests script](/tests/integration/integration-tests.sh). Which triggers the [tests](/tests/integration/) and runs them through `cypress-runner.js`.

### Env Variables

#### `SAUCE_CYPRESS_VIDEO_RECORDING`

This env variable is for controlling cypress native video recording.
`true`/`1` will enable cypress native video recording.
`false`/`0` will stop cypress native video recording.

```sh
saucectl run -e SAUCE_CYPRESS_VIDEO_RECORDING=true
```

## Reading `env` values on Cypress 16 (runner v15 and later)

Cypress 16 removed `Cypress.env()`; calling it now throws. The runner makes every value from a saucectl suite `env:` block, plus `SAUCE_SUITE_NAME` and `SAUCE_ARTIFACTS_DIRECTORY`, available in two ways.

Synchronously, with `Cypress.expose()`:

```js
const host = Cypress.expose('host');
cy.visit(host);
```

Asynchronously, with the `cy.env()` command:

```js
cy.env(['host', 'SAUCE_SUITE_NAME']).then(({ host, SAUCE_SUITE_NAME }) => {
  cy.log(`Running suite ${SAUCE_SUITE_NAME}`);
  cy.visit(host);
});
```

To migrate, replace `Cypress.env('X')` with `Cypress.expose('X')`, or use `cy.env(['X'])` when you are already inside a command chain.

Every `env:` value is available in the browser exactly as it was on Cypress 15, whichever API you use to read it.
