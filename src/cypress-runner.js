const { sauceReporter }   = require('./sauce-reporter');
const fs = require('fs');

const cypress = require('cypress');
const DEFAULT_BROWSER = 'chrome';
process.env.SAUCE_BUILD_NAME = process.env.SAUCE_BUILD_NAME || `stt-cypress-build-${(new Date()).getTime()}`;

const supportedBrowsers = {
  'chrome': 'chrome'
}
let browserName = process.env.BROWSER_NAME || DEFAULT_BROWSER;
browserName = supportedBrowsers[browserName.toLowerCase()];
if (!browserName) {
  console.error(`Unsupported browser: ${browserName}. Sorry.`);
  process.exit(1);
}

const report = async (run) => {
  fs.renameSync(
    run.video,
    '/tmp/video.mp4'
  )
  await sauceReporter(browserName,  buildName, [
    '/tmp/video.mp4'
  ], run);
  fs.unlinkSync('/tmp/video.mp4');
}

(async () => {
  try {
    let failures = 0;
    let results = await cypress.run({
      browser: browserName,
      config: {
        video: true,
        videosFolder: "cypress/results",
        videoCompression: false,
        videoUploadOnPasses: false,
        screenshotsFolder: "cypress/results",
        testFiles: "tests/*.js",
        reporter: "src/sauce-reporter.js",
        reporterOptions: {
          mochaFile: "cypress/results/[suite].xml"
        }
      }
    });
    for (let run of results.runs) {
      failures += run.stats.failures;
    }
    process.exit(failures);
  }catch (err) {
    console.log(err);
    process.exit(1);
  }
})();

/*


(async() => {
  try {
    let results = await runCypress();
    if (process.env.SAUCE_USERNAME && process.env.SAUCE_ACCESS_KEY) {
      
      await sauceReporter('chrome', [
        '/home/seluser/cypress/videos/tests/video.mp4'
      ], results);
    } else {
      console.log('Skipping asset uploads! Remeber to setup your SAUCE_USERNAME/SAUCE_ACCESS_KEY')
    }
    process.exit(results);
  } catch(e) {
    console.log(e);
  }
})();
*/