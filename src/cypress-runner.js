const { sauceReporter }   = require('./sauce-reporter');
const fs = require('fs');

const cypress = require('cypress');
const DEFAULT_BROWSER = 'chrome';
const buildName = process.env.SAUCE_BUILD_NAME || `stt-cypress-build-${(new Date()).getTime()}`;
const supportedBrowsers = {
  'chrome': 'chrome',
  'firefox': 'firefox'
}
let browserName = process.env.BROWSER_NAME || DEFAULT_BROWSER;
browserName = supportedBrowsers[browserName.toLowerCase()];
if (!browserName) {
  console.error(`Unsupported browser: ${process.env.BROWSER_NAME}. Sorry.`);
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

const yaml = require('js-yaml');
const config = yaml.safeLoad(fs.readFileSync('config.yaml', 'utf8'))

const cypressRunner = async function () {
  try {
    const results = await cypress.run({
      browser: browserName,
      config: {
        video: true,
        videosFolder: config.reportsDir,
        videoCompression: false,
        videoUploadOnPasses: false,
        screenshotsFolder: config.reportsDir,
        integrationFolder: config.targetDir,
        testFiles: `${config.targetDir}/**/?(*.)+(spec|test).[jt]s?(x)`,
        reporter: "src/custom-reporter.js",
        reporterOptions: {
          mochaFile: `${config.reportsDir}/[suite].xml`
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