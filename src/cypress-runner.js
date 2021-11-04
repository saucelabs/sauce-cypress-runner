const { sauceReporter, prepareAssets } = require('./sauce-reporter');
const path = require('path');
const fs = require('fs');
const { shouldRecordVideo, getAbsolutePath, loadRunConfig, prepareNpmEnv, getArgs, getEnv } = require('sauce-testrunner-utils');
const cypress = require('cypress');
const util = require('util');
const _ = require('lodash');

const report = async (results = {}, statusCode, browserName, runCfg, suiteName, startTime, endTime, metrics) => {
  // Prepare the assets
  const runs = results.runs || [];
  let specFiles = runs.map((run) => run.spec.name);

  let failures = results.failures || results.totalFailed;

  let assets = await prepareAssets(
      specFiles,
      runCfg.resultsDir,
      metrics
  );
  const passed = failures === 0 && statusCode === 0
  // Run in cloud mode
  if (process.env.SAUCE_VM) {
    return passed;
  }
  if (!(process.env.SAUCE_USERNAME && process.env.SAUCE_ACCESS_KEY)) {
    console.log('Skipping asset uploads! Remember to setup your SAUCE_USERNAME/SAUCE_ACCESS_KEY');
    return passed;
  }
  // Run in docker mode
  if (process.env.SAUCE_USERNAME !== '' && process.env.SAUCE_ACCESS_KEY !== '') {
    // check result
    await sauceReporter(runCfg, suiteName, browserName, assets, failures, startTime, endTime);
  }
  return passed;
};

const getCypressOpts = function (runCfg, suiteName) {
  // Get user settings from suites.
  const suites = runCfg.suites || [];
  const suite = suites.find((testSuite) => testSuite.name === suiteName);
  if (!suite) {
    const suiteNames = suites.map((suite) => suite.name);
    throw new Error(`Could not find suite named '${suiteName}'; available suites='${JSON.stringify(suiteNames)}`);
  }

  let cypressCfgFile = path.basename(runCfg.cypress.configFile);
  if (!fs.existsSync(getAbsolutePath(cypressCfgFile))) {
    throw new Error(`Unable to locate the cypress config file. Looked for '${getAbsolutePath(cypressCfgFile)}'.`);
  }

  const cypressCfg = JSON.parse(fs.readFileSync(cypressCfgFile, 'utf8'));

  let opts = {
    project: path.dirname(getAbsolutePath(runCfg.path)),
    browser: process.env.SAUCE_BROWSER || suite.browser || 'chrome',
    configFile: cypressCfgFile,
    config: {
      testFiles: suite.config.testFiles,
      videosFolder: runCfg.resultsDir,
      screenshotsFolder: runCfg.resultsDir,
      video: shouldRecordVideo(),
      reporter: path.join(__dirname, 'custom-reporter.js'),
      reporterOptions: {
        mochaFile: `${runCfg.resultsDir}/[suite].xml`,
        specRoot: cypressCfg.integrationFolder || 'cypress/integration',
      },
      videoCompression: false,
      videoUploadOnPasses: false,
      env: getEnv(suite),
    }
  };

  if (runCfg.cypress.record && runCfg.cypress.key !== undefined) {
    opts.record = runCfg.cypress.record;
    opts.key = runCfg.cypress.key;
    opts.config.videoUploadOnPasses = true;
  }

  _.defaultsDeep(opts.config, suite.config);
  return opts;
};

const canAccessFolder = async function (file) {
  const fsAccess = util.promisify(fs.access);
  await fsAccess(file, fs.constants.R_OK | fs.constants.W_OK);
};

const cypressRunner = async function (runCfgPath, suiteName, timeoutSec) {
  runCfgPath = getAbsolutePath(runCfgPath);
  const runCfg = await loadRunConfig(runCfgPath);
  runCfg.path = runCfgPath;
  runCfg.resultsDir = path.join(path.dirname(runCfgPath), '__assets__');
  try {
    await canAccessFolder(runCfg.resultsDir);
  } catch (err) {
    const fsMkdir = util.promisify(fs.mkdir);
    await fsMkdir(runCfg.resultsDir);
    await canAccessFolder(runCfg.resultsDir);
  }

  let metrics = [];
  let npmMetrics = await prepareNpmEnv(runCfg);
  metrics.push(npmMetrics);
  let cypressOpts = getCypressOpts(runCfg, suiteName);
  let startTime = new Date().toISOString();
  let timeout;
  const timeoutPromise = new Promise((resolve) => {
    timeout = setTimeout(() => {
      console.error(`Test timed out after ${timeoutSec} seconds`);
      resolve();
    }, timeoutSec * 1000);
  });

  let results = await Promise.race([timeoutPromise, cypress.run(cypressOpts)]);
  clearTimeout(timeout);
  const statusCode = !results ? 1 : 0;
  let endTime = new Date().toISOString();

  return await report(results, statusCode, cypressOpts.browser, runCfg, suiteName, startTime, endTime, metrics);
};

// For dev and test purposes, this allows us to run our Cypress Runner from command line
if (require.main === module) {
  console.log(`Sauce Cypress Runner ${require(path.join(__dirname, '..', 'package.json')).version}`);
  const { runCfgPath, suiteName } = getArgs();
  // maxTimeout maximum test execution timeout is 1800 seconds (30 mins)
  const maxTimeout = 1800;

  cypressRunner(runCfgPath, suiteName, maxTimeout)
      // eslint-disable-next-line promise/prefer-await-to-then
      .then((passed) => process.exit(passed ? 0 : 1))
      // eslint-disable-next-line promise/prefer-await-to-callbacks
      .catch((err) => {
        console.log(err);
        process.exit(1);
      });
}

exports.cypressRunner = cypressRunner;
