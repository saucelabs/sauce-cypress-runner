const { defineConfig } = require('cypress');

module.exports = defineConfig({
  // Enables WebKit so the Apple Silicon post release smoke can launch WebKit on macOS 14 and 15.
  experimentalWebKitSupport: true,
  // setupNodeEvents can be defined in either
  // the e2e or component configuration
  e2e: {
    supportFile: 'cypress/support/e2e.js',
  },
});
