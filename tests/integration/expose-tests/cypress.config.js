const { defineConfig } = require('cypress');

module.exports = defineConfig({
  expose: {
    FROM_CONFIG: 'config-value',
    SHARED: 'config-value',
  },
  e2e: {
    supportFile: false,
  },
});
