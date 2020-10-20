jest.mock('cypress');

const cypress = require('cypress');
const { cypressRunner } = require('../../../src/cypress-runner');

describe('.cypressRunner', function () {
  let oldEnv = { ...process.env };
  let cypressRunSpy;
  beforeEach(function () {
    process.env = { ...oldEnv };
    cypressRunSpy = jest.spyOn(cypress, 'run');
    cypress.run.mockImplementation(() => ([]));
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
});