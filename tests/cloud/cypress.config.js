// eslint-disable-next-line @typescript-eslint/no-var-requires
const { defineConfig } = require('cypress');

module.exports = defineConfig({
  // setupNodeEvents can be defined in either
  // the e2e or component configuration
  e2e: {
    supportFile: 'cypress/support/e2e.js',
    experimentalWebKitSupport: true,
  },
});
