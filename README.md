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

Cypress 16 removed `Cypress.env()`; calling it now throws. Read values with `Cypress.expose()` or the `cy.env()` command instead. The two APIs see different sources.

`Cypress.expose()` is synchronous and sees exactly:

- the values from the saucectl suite `env:` block,
- `SAUCE_SUITE_NAME` and `SAUCE_ARTIFACTS_DIRECTORY`, set by the runner,
- the `expose` block of your own `cypress.config.*`.

```js
const host = Cypress.expose('host');
cy.visit(host);
```

`cy.env([...])` is a command and sees every `env` source: the suite `env:` values, `cypress.env.json`, the `env` block of your `cypress.config.*` and `CYPRESS_*` OS variables.

```js
cy.env(['host', 'SAUCE_SUITE_NAME']).then(({ host, SAUCE_SUITE_NAME }) => {
  cy.log(`Running suite ${SAUCE_SUITE_NAME}`);
  cy.visit(host);
});
```

Values from `cypress.env.json`, the `env` block of your `cypress.config.*` and `CYPRESS_*` OS variables are readable only with `cy.env([...])`, unless you move them to the `expose` block of your config.

To migrate:

- for values from a saucectl suite `env:` block, replace `Cypress.env('X')` with `Cypress.expose('X')`;
- for anything else, use `cy.env(['X'])` inside a command chain.

Suite `env:` keys written with a `CYPRESS_` prefix, such as `CYPRESS_PREF`, are readable as `cy.env(['PREF'])` (prefix stripped, as `Cypress.env()` did) or as `Cypress.expose('CYPRESS_PREF')` (prefix kept). `Cypress.expose('PREF')` returns `undefined`.

If a suite `env:` block defines `SAUCE_SUITE_NAME` or `SAUCE_ARTIFACTS_DIRECTORY`, `Cypress.expose()` returns the runner's value and `cy.env()` returns the suite's value.

Every suite `env:` value is visible in the browser, as it was on Cypress 15.

## Known limitations on runner v15 (Cypress 16)

- macOS 11 is no longer supported. Cypress 16 requires macOS 12 or later.
- The bundled `@badeball/cypress-cucumber-preprocessor` moved from 24 to 28. It now reads only the
  lowercase `tags` option. A suite that still sets `env: TAGS: "@smoke"` is not filtered: no error is
  raised and every scenario runs. Rename the key to `tags` (for example `env: tags: "@smoke"` in your
  saucectl suite). Other upstream changes: use `-x/--expose` instead of `-e/--env` for command-line
  overrides, the soft-expectation flag is removed, and Cypress 12 is no longer supported.
- The bundled `@shelex/cypress-allure-plugin` 2.41.2 does not work with Cypress 16. Importing it fails every spec, because it calls the removed `Cypress.env()` when it loads. Use [`allure-cypress`](https://www.npmjs.com/package/allure-cypress) instead, installed through saucectl `npm.packages`.
