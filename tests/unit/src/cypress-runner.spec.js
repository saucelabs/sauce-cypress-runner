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
  it('uses CWD when SAUCE_VM is set', async function () {
    process.env.SAUCE_VM = 'truthy';
    process.env.SAUCE_USERNAME = null;
    process.env.SAUCE_ACCESS_KEY = null;
    await cypressRunner();
    const cwd = process.cwd();
    const expectedCypressRun = [
      [{
        browser: 'chrome',
        configFile: 'cypress.json',
        config: {
          env: {},
          video: true,
          videosFolder: `${cwd}/cypress/results`,
          videoCompression: false,
          videoUploadOnPasses: false,
          screenshotsFolder: `${cwd}/cypress/results`,
          integrationFolder: `${cwd}/cypress/integration`,
          testFiles: `${cwd}/cypress/integration/**/*.*`,
          reporter: 'src/custom-reporter.js',
          reporterOptions: {
            mochaFile: `${cwd}/cypress/results/[suite].xml`,
            specFolder: `${cwd}/cypress/integration`,
          }
        }
      }]
    ];
    expect(cypressRunSpy.mock.calls).toEqual(expectedCypressRun);
  });
});