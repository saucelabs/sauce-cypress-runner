jest.mock('cypress');
jest.mock('fs');
jest.mock('../../../src/sauce-reporter');
jest.mock('../../../src/utils');

const cypress = require('cypress');
const path = require('path');
const fs = require('fs');
const { sauceReporter, prepareAssets } = require('../../../src/sauce-reporter');
const { cypressRunner } = require('../../../src/cypress-runner');
const { loadRunConfig } = require('../../../src/utils');

describe('.cypressRunner', function () {
  let oldEnv = { ...process.env };
  let cypressRunSpy;
  cypressRunSpy = jest.spyOn(cypress, 'run');
  beforeEach(function () {
    jest.resetModules();
    process.env = { ...oldEnv };
    cypressRunSpy.mockClear();
    const cypressRunResults = {
      runs: [{spec: {name: 'spec-a'}}, {spec: {name: 'spec-b'}}],
      failures: [],
    };
    cypress.run.mockImplementation(() => cypressRunResults);
    prepareAssets.mockClear();
    prepareAssets.mockImplementation(() => (['spec-a', 'spec-b']));
    const fakeRunnerJson = {
      cypress: {
        configFile: 'fake-cypress.json',
      },
      suites: [
        {name: 'fake-suite', config: {}}
      ]
    };
    loadRunConfig.mockImplementation(() => fakeRunnerJson);
    fs.existsSync.mockImplementation(() => true);
    fs.readFileSync.mockImplementation(() => JSON.stringify(fakeRunnerJson));
  });
  it('can call Cypress.run with basic args', async function () {
    process.env.SAUCE_USERNAME = null;
    process.env.SAUCE_ACCESS_KEY = null;
    await cypressRunner('/fake/runner/path', 'fake-suite');
    // Change reporter to not be fully-qualified path
    const {reporter} = cypressRunSpy.mock.calls[0][0].config;
    cypressRunSpy.mock.calls[0][0].config.reporter = path.basename(reporter);
    expect(cypressRunSpy.mock.calls).toMatchSnapshot();
    expect(prepareAssets.mock.calls).toEqual([
      [
        ['spec-a', 'spec-b'], '__assets__'
      ]
    ]);
  });
  it('can hardcode the browser path', async function () {
    process.env.SAUCE_BROWSER = 'C:/User/App/browser.exe:chrome';
    await cypressRunner('/fake/runner/path', 'fake-suite');
    const calledBrowser = cypressRunSpy.mock.calls[0][0].browser;
    expect(calledBrowser).toEqual('C:/User/App/browser.exe:chrome');
  });
  it('calls sauce reporter and returns a job status', async function () {
    process.env.SAUCE_USERNAME = 'bruno.alassia';
    process.env.SAUCE_ACCESS_KEY = 'i_l0ve_mayonnaise';
    process.env.SAUCE_BROWSER = 'firefox';
    sauceReporter.mockClear();
    await cypressRunner('/fake/runner/path', 'fake-suite');
    expect(sauceReporter.mock.calls).toMatchSnapshot();
  });
  it('throws error if browser is unsupported', function () {
    process.env.BROWSER_NAME = 'lynx';
    expect(cypressRunner('/fake/runner/path', 'fake-suite')).rejects.toThrow(new Error(
      `Unsupported browser: 'lynx'. Sorry.`
    ));
  });
  describe('from SAUCE VM', function () {
    it('returns false if there are test failures', async function () {
      process.env.SAUCE_VM = 'truthy';
      cypressRunSpy.mockImplementation(() => ({failures: 100}));
      const status = await cypressRunner('/fake/runner/path', 'fake-suite');
      expect(status).toEqual(false);
    });
    it('returns true if there are no test failures', async function () {
      process.env.SAUCE_VM = 'truthy';
      cypressRunSpy.mockImplementation(() => ({failures: 0}));
      const status = await cypressRunner('/fake/runner/path', 'fake-suite');
      expect(status).toEqual(false);
    });
  });
});