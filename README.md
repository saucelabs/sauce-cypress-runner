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

## Cypress 16 (runner v15 and later)

- `Cypress.env()` is removed and throws. Read values from your saucectl suite `env:` block with
  `Cypress.expose('X')` or `cy.env(['X'])`. `cy.env()` also reads `cypress.env.json`, the `env` block
  of your Cypress config and `CYPRESS_*` variables.
- Every value in the suite `env:` block is readable in the browser through `Cypress.expose()`, as it
  was through `Cypress.env()` before Cypress 16. The application under test can read it too. For
  secrets it must not see, write them to `cypress.env.json` in a CI step before `saucectl run`
  instead of committing the file, and read them with `cy.env()`. Values in that file are not exposed.
  Make sure your `.sauceignore` does not exclude it.
- macOS 11 is no longer supported. Cypress 16 ships Electron 41, which needs macOS 12 or later.
  Cypress documents macOS 13.5 and later as supported.
- The bundled `@badeball/cypress-cucumber-preprocessor` is now 28, which reads only the lowercase
  `tags` option. The runner copies a suite's `TAGS` value to `tags`, so suites that set `env: TAGS`
  keep filtering. If a suite sets both, `TAGS` wins, as it did before.
- `@shelex/cypress-allure-plugin` is no longer bundled, because it does not work with Cypress 16. Use
  `allure-cypress` instead, installed through saucectl `npm.packages`.
- See the [Cypress migration guide](https://docs.cypress.io/app/references/migration-guide) for the
  other Cypress 16 changes, such as the removal of `cy.exec()`.
