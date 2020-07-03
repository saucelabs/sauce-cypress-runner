const { sauceReporter }   = require('./sauce-reporter');
const fs = require('fs');

const cypress = require('cypress');
const DEFAULT_BROWSER = 'chrome';
const buildName = process.env.SAUCE_BUILD_NAME || `stt-cypress-build-${(new Date()).getTime()}`;
const supportedBrowsers = {
  'chrome': 'chrome'
}
let browserName = process.env.BROWSER_NAME || DEFAULT_BROWSER;
browserName = supportedBrowsers[browserName.toLowerCase()];
if (!browserName) {
  console.error(`Unsupported browser: ${browserName}. Sorry.`);
  process.exit(1);
}

const report = async (results) => {
  const status = results.failures || results.totalFailed;
  if (!(process.env.SAUCE_USERNAME && process.env.SAUCE_ACCESS_KEY)) {
    console.log('Skipping asset uploads! Remeber to setup your SAUCE_USERNAME/SAUCE_ACCESS_KEY');
    return status;
  }
  const runs = results.runs || [];
  for(let spec of runs) {
    await sauceReporter(buildName, browserName, spec);
  };
  return status;
}

const cypressRunner = async function () {
  try {
    const results = await cypress.run({
      browser: browserName,
      config: {
        video: true,
        videosFolder: "cypress/results",
        videoCompression: false,
        videoUploadOnPasses: false,
        screenshotsFolder: "cypress/results",
        integrationFolder: "cypress/integration/tests",
        testFiles: "**/*.js",
        reporter: "src/custom-reporter.js",
        reporterOptions: {
          mochaFile: "cypress/results/[suite].xml"
        }
      }
    });
    const status = await report(results);
    process.exit(status);
  }catch (err) {
    console.log(err);
    process.exit(1);
  }
}

exports.cypressRunner = cypressRunner