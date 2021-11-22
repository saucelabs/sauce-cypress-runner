jest.mock('cypress');
jest.mock('fs');
jest.mock('sauce-testrunner-utils');
jest.mock('../../../src/sauce-reporter');
jest.mock('@saucelabs/cypress-plugin');

const utils = require('sauce-testrunner-utils');
const { loadRunConfig, getAbsolutePath } = require('sauce-testrunner-utils');
const cypress = require('cypress');
const path = require('path');
const fs = require('fs');
const SauceReporter = require('../../../src/sauce-reporter');
const { cypressRunner } = require('../../../src/cypress-runner');
const {afterRunTestReport} = require('@saucelabs/cypress-plugin');

describe('.cypressRunner', function () {
  let oldEnv = { ...process.env };
  let cypressRunSpy;
  cypressRunSpy = jest.spyOn(cypress, 'run');
  beforeEach(function () {
    process.env = { ...oldEnv };
    cypressRunSpy.mockClear();
    const cypressRunResults = {
      runs: [{spec: {name: 'spec-a'}}, {spec: {name: 'spec-b'}}],
      failures: [],
    };
    cypress.run.mockImplementation(() => cypressRunResults);
    SauceReporter.prepareAssets.mockClear();
    SauceReporter.prepareAssets.mockImplementation(() => (['spec-a', 'spec-b']));
    const fakeRunnerJson = {
      cypress: {
        configFile: 'fake-cypress.json',
      },
      suites: [
        {name: 'fake-suite', platformName: 'Windows 10', config: {env: {HELLO: 'WORLD'}}}
      ]
    };
    getAbsolutePath.mockImplementation((path) => path);
    loadRunConfig.mockImplementation(() => fakeRunnerJson);
    fs.existsSync.mockImplementation(() => true);
    fs.readFileSync.mockImplementation(() => JSON.stringify(fakeRunnerJson));
    fs.mkdir.mockImplementation((obj, resolver) => resolver(null));
    fs.access.mockImplementation((obj, constants, resolver) => resolver(null));
    utils.prepareNpmEnv.mockImplementation(() => 'some metricz');
    afterRunTestReport.mockImplementation(() => {});

    // Mock the dates so that it's deterministic
    const isoDateSpy = jest.spyOn(Date.prototype, 'toISOString');
    let day = 0;
    isoDateSpy.mockImplementation(() => `Date: ${++day}`);
  });
  afterEach(function () {
    SauceReporter.sauceReporter.mockReset();
  });
  it('returns failure if Cypress.run is called with a timeout of 0 (Docker mode)', async function () {
    const run = new Promise((resolve) => {
      setTimeout(resolve, 10);
    });
    cypress.run.mockImplementation(() => run);
    process.env.SAUCE_USERNAME = 'fake-sauce-username';
    process.env.SAUCE_ACCESS_KEY = 'fake-sauce-accesskey';
    const status = await cypressRunner('/fake/runner/path', 'fake-suite', 2);
    expect(status).toEqual(false);
  });
  it('can call Cypress.run with basic args', async function () {
    process.env.SAUCE_USERNAME = 'fake-sauce-username';
    process.env.SAUCE_ACCESS_KEY = 'fake-sauce-accesskey';
    await cypressRunner('/fake/runner/path', 'fake-suite', 1);
    // Change reporter to not be fully-qualified path
    cypressRunSpy.mock.calls[0][0].config.reporter = path.basename(cypressRunSpy.mock.calls[0][0].config.reporter);
    cypressRunSpy.mock.calls[0][0].config.reporterOptions.configFile = path.basename(cypressRunSpy.mock.calls[0][0].config.reporterOptions.configFile);
    expect(cypressRunSpy.mock.calls).toMatchSnapshot();
    expect(SauceReporter.prepareAssets.mock.calls).toMatchSnapshot();
  });
  it('can hardcode the browser path', async function () {
    process.env.SAUCE_BROWSER = 'C:/User/App/browser.exe:chrome';
    await cypressRunner('/fake/runner/path', 'fake-suite', 1);
    const calledBrowser = cypressRunSpy.mock.calls[0][0].browser;
    expect(calledBrowser).toEqual('C:/User/App/browser.exe:chrome');
  });
  it('calls sauce reporter and returns a job status', async function () {
    process.env.SAUCE_USERNAME = 'bruno.alassia';
    process.env.SAUCE_ACCESS_KEY = 'i_l0ve_mayonnaise';
    process.env.SAUCE_BROWSER = 'firefox';
    await cypressRunner('/fake/runner/path', 'fake-suite', 1);
    expect(SauceReporter.sauceReporter.mock.calls).toMatchSnapshot();
  });
  describe('from SAUCE VM', function () {
    beforeEach(function () {
      process.env.SAUCE_VM = 'truthy';
    });
    it('returns false if there are test failures', async function () {
      cypressRunSpy.mockImplementation(() => ({failures: 100}));
      const status = await cypressRunner('/fake/runner/path', 'fake-suite', 1);
      expect(status).toEqual(false);
    });
    it('returns true if there are no test failures', async function () {
      cypressRunSpy.mockImplementation(() => ({failures: 0}));
      const status = await cypressRunner('/fake/runner/path', 'fake-suite', 1);
      expect(status).toEqual(false);
    });
    it('should take config.env as argument (DEVX-477)', async function () {
      cypressRunSpy.mockImplementation(() => ({}));
      await cypressRunner('/fake/runner/path', 'fake-suite', 1);
      const { calls } = cypressRunSpy.mock;

      // Rename to basename to remove home dir
      calls[0][0].config.reporter = path.basename(calls[0][0].config.reporter);
      calls[0][0].config.reporterOptions.configFile = path.basename(calls[0][0].config.reporterOptions.configFile);
      expect(cypressRunSpy.mock.calls).toMatchSnapshot();
    });
    it('Cypress.run returns false if it times out (Sauce VM mode)', async function () {
      const run = new Promise((resolve) => {
        setTimeout(resolve, 10);
      });
      cypress.run.mockImplementation(() => run);
      const status = await cypressRunner('/fake/runner/path', 'fake-suite', 1);
      expect(status).toEqual(false);
    });
  });
});
