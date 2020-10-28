jest.mock('cypress');
jest.mock('../../../src/sauce-reporter');

const cypress = require('cypress');
const { sauceReporter } = require('../../../src/sauce-reporter');
const { cypressRunner } = require('../../../src/cypress-runner');

describe('.cypressRunner', function () {
  let oldEnv = { ...process.env };
  let cypressRunSpy;
  cypressRunSpy = jest.spyOn(cypress, 'run');
  beforeEach(function () {
    jest.resetModules();
    process.env = { ...oldEnv };
    cypressRunSpy.mockClear();
    const cypressRunResults = {
      runs: ['spec-a', 'spec-b'],
      failures: [],
    };
    cypress.run.mockImplementation(() => cypressRunResults);
  });
  it('can hardcode locations of reports, target and root', async function () {
    process.env.SAUCE_REPORTS_DIR = '/path/to/results';
    process.env.SAUCE_TARGET_DIR = '/path/to/target';
    process.env.SAUCE_ROOT_DIR = '/path/to/root';
    process.env.SAUCE_USERNAME = null;
    process.env.SAUCE_ACCESS_KEY = null;
    await cypressRunner();
    const expectedCypressRun = [
      [{
        browser: 'chrome',
        configFile: 'cypress.json',
        config: {
          env: {},
          video: true,
          videosFolder: '/path/to/results',
          videoCompression: false,
          videoUploadOnPasses: false,
          screenshotsFolder: '/path/to/results',
          integrationFolder: '/path/to/target',
          testFiles: [
            '**/?(*.)+(spec|test).[jt]s?(x)'
          ],
          reporter: 'src/custom-reporter.js',
          reporterOptions: {
            mochaFile: '/path/to/results/[suite].xml',
            specFolder: '/path/to/target',
          }
        }
      }]
    ];
    expect(cypressRunSpy.mock.calls).toEqual(expectedCypressRun);
  });
  it('can hardcode the browser path', async function () {
    process.env.BROWSER_NAME = 'chrome';
    process.env.SAUCE_BROWSER_PATH = 'C:/User/App/browser.exe';
    await cypressRunner();
    const calledBrowser = cypressRunSpy.mock.calls[0][0].browser;
    expect(calledBrowser).toEqual('C:/User/App/browser.exe:chrome');
  });
  it('calls sauce reporter and returns a job status', async function () {
    process.env.SAUCE_BUILD_NAME = 'fake-build-name';
    process.env.BROWSER_NAME = 'firefox';
    sauceReporter.mockClear();
    await cypressRunner();
    expect(sauceReporter.mock.calls).toEqual([
      ['fake-build-name', 'firefox', 'spec-a'],
      ['fake-build-name', 'firefox', 'spec-b'],
    ]);
  });
  it('throws error if browser is unsupported', function () {
    process.env.BROWSER_NAME = 'lynx';
    expect(cypressRunner()).rejects.toThrow(new Error(
      `Unsupported browser: 'lynx'. Sorry.`
    ));
  });
});