const { sauceReporter, prepareAssets } = require('./sauce-reporter');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const { shouldRecordVideo } = require('./utils');
const cypress = require('cypress');
const yargs = require('yargs/yargs');
// let { exec } = require('child_process');

// Promisify the callback functions
const fileExists = promisify(fs.exists);
const readFile = promisify(fs.readFile);
// exec = promisify(exec);

async function loadRunConfig (cfgPath) {
  if (await fileExists(cfgPath)) {
    return JSON.parse(await readFile(cfgPath, 'utf8'));
  }
  console.error(`Run config (${cfgPath}) unavailable.`);
}

const report = async (results, browserName) => {
  // Prepare the assets
  const runs = results.runs || [];
  const resultsFolder = process.env.SAUCE_REPORTS_DIR || 'cypress/results';
  let specFiles = runs.map((run) => run.spec.name);
  let assets = await prepareAssets(
    specFiles,
    resultsFolder,
  );

  let failures = results.failures || results.totalFailed;
  if (!(process.env.SAUCE_USERNAME && process.env.SAUCE_ACCESS_KEY)) {
    console.log('Skipping asset uploads! Remember to setup your SAUCE_USERNAME/SAUCE_ACCESS_KEY');
    return failures === 0;
  }
  if (process.env.SAUCE_VM) {
    console.log('Skipping asset upload inside of sauce vm. Asset uploads will take place in post process batch job');
    return failures === 0;
  }
  const buildName = process.env.SAUCE_BUILD_NAME || `stt-cypress-build-${(new Date()).getTime()}`;
  await sauceReporter(buildName, browserName, assets, failures);

  return failures === 0;
};

const getCypressOpts = function (runCfg, suiteName) {
  // const resultsFolder = path.join('__assets__'); // TODO this is what dan had
  const resultsFolder = 'cypress/results'; // that's where we collect assets from

  // Get user settings from suites.
  const suites = runCfg.suites || [];
  const suite = suites.find((testSuite) => testSuite.name === suiteName);
  if (!suite) {
    throw new Error(`Could not find suite named '${suiteName}'; available suites='${suites}`);
  }

  let cypressCfgFile = path.basename(runCfg.cypress.configFile);
  if (!fs.existsSync(cypressCfgFile)) {
    throw new Error(`Unable to locate the cypress config file. Looked for '${cypressCfgFile}'.`);
  }

  let cypressOpts = {
    browser: suite.browser || 'chrome',
    configFile: cypressCfgFile,
    config: {
      testFiles: suite.testFiles,
      videosFolder: resultsFolder,
      screenshotsFolder: resultsFolder,
      video: shouldRecordVideo(),
      reporter: path.join('src', 'custom-reporter.js'),
      reporterOptions: {
        mochaFile: `${resultsFolder}/[suite].xml`,
        specFolder: `${resultsFolder}/`,
        specRoot: runCfg.integrationFolder || 'cypress/integration', // TODO this setting doesn't exist in saucectl yet
      },
      videoCompression: false,
      videoUploadOnPasses: false,
    }
  };

  return cypressOpts;
};

const cypressRunner = async function (runCfgPath, suiteName) {
  // Get the configuration info from config.yaml
  // const {rootDir, reportsDir, targetDir} = await getRunnerConfig();

  const runCfg = await loadRunConfig(runCfgPath);
  let cypressOpts = getCypressOpts(runCfg, suiteName);

  const results = await cypress.run(cypressOpts);

  // const results = await cypress.run({
  //   browser,
  //   configFile,
  //   config: {
  //     env,
  //     video: shouldRecordVideo(),
  //     videosFolder: reportsDir,
  //     videoCompression: false,
  //     videoUploadOnPasses: false,
  //     screenshotsFolder: reportsDir,
  //     testFiles: suite.testFiles,
  //     reporter: path.join('src/custom-reporter.js'),
  //     reporterOptions: {
  //       mochaFile: `${reportsDir}/[suite].xml`,
  //       specFolder: targetDir,
  //     },
  //   }
  // });

  return await report(results, cypressOpts.browser);
};

// For dev and test purposes, this allows us to run our Cypress Runner from command line
if (require.main === module) {
  const argv = yargs(process.argv.slice(2))
      .command('$0', 'the default command')
      .option('runCfgPath', {
        alias: 'r',
        type: 'string',
        description: 'Path to sauce runner json',
        default: path.join(process.cwd(), '.sauce', 'runner.json'),
      })
      .option('suiteName', {
        alias: 's',
        type: 'string',
        description: 'Select the suite to run'
      })
      .argv;
  // FIXME make suite option mandatory
  // FIXME considering making run-cfg mandatory
  const { runCfgPath, suiteName } = argv;

  cypressRunner(runCfgPath, suiteName)
      // eslint-disable-next-line promise/prefer-await-to-then
      .then((passed) => process.exit(passed ? 0 : 1))
      // eslint-disable-next-line promise/prefer-await-to-callbacks
      .catch((err) => {
        console.log(err);
        process.exit(1);
      });
}

exports.cypressRunner = cypressRunner;
