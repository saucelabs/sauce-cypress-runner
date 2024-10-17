/**
 * For a detailed explanation regarding each configuration property, visit:
 * https://jestjs.io/docs/configuration
 */

/** @type {import('jest').Config} */
module.exports = {
  // Automatically clear mock calls, instances, contexts and results before every test
  clearMocks: true,

  // Indicates which provider should be used to instrument code for coverage
  coverageProvider: 'v8',

  // A map from regular expressions to paths to transformers
  transform: { '^.+\\.ts?$': 'ts-jest' },

  testMatch: ["**/tests/unit/**/*.[jt]s?(x)"],
  modulePathIgnorePatterns: ["cypress/tests/unit/"],
  collectCoverageFrom: ["src/**/*.js"],
  collectCoverage: true
};
