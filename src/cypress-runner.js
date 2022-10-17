const { sauceReporter, prepareAssets } = require('./sauce-reporter');
const path = require('path');
const fs = require('fs');
const { shouldRecordVideo, getAbsolutePath, loadRunConfig, prepareNpmEnv, getArgs, getEnv, preExec } = require('sauce-testrunner-utils');
const cypress = require('cypress');
const util = require('util');
const _ = require('lodash');
const {afterRunTestReport} = require('@saucelabs/cypress-plugin');

const report = async (results = {}, statusCode, browserName, runCfg, suiteName, startTime, endTime, metrics) => {
  // Prepare the assets
  const runs = results.runs || [];
  let specFiles = runs.map((run) => path.basename(run.spec.name));

  let failures = results.failures || results.totalFailed;
  let platformName = '';
  for (let c of runCfg.suites) {
    if (c.name === suiteName) {
      platformName = c.platformName;
      break;
    }
  }

  let assets = await prepareAssets(
      specFiles,
      runCfg.resultsDir,
      metrics,
      suiteName,
      browserName,
      platformName,
  );

  try {
    let reportJSON = afterRunTestReport(results);
    const filepath = path.join(runCfg.resultsDir, 'sauce-test-report.json');
    reportJSON.toFile(filepath);
    assets.push(filepath);
  } catch (e) {
    console.error('Failed to serialize test results: ', e);
  }

  const passed = failures === 0 && statusCode === 0;
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
    await sauceReporter(runCfg, suiteName, browserName, assets, failures, startTime, endTime);
  }
  return passed;
};

// Configure reporters
const configureReporters = function (runCfg, opts) {
  // Enable cypress-multi-reporters plugin
  opts.config.reporter = path.join(__dirname, '../node_modules/cypress-multi-reporters/lib/MultiReporters.js');
  opts.config.reporterOptions = {
    configFile: path.join(__dirname, '..', 'sauce-reporter-config.json'),
  };

  const customReporter = path.join(__dirname, '../src/custom-reporter.js');
  const junitReporter = path.join(__dirname, '../node_modules/mocha-junit-reporter/index.js');

  let defaultSpecRoot = '';
  if (opts.testingType === 'component') {
    defaultSpecRoot = 'cypress/component';
  } else {
    defaultSpecRoot = 'cypress/e2e';
  }

  // Referencing "mocha-junit-reporter" using relative path will allow to have multiple instance of mocha-junit-reporter.
  // That permits to have a configuration specific to us, and in addition to keep customer's one.
  let reporterConfig = {
    reporterEnabled: `spec, ${customReporter}, ${junitReporter}`,
    [[_.camelCase(customReporter), 'ReporterOptions'].join('')]: {
      mochaFile: `${runCfg.resultsDir}/[suite].xml`,
      specRoot: defaultSpecRoot
    },
    [[_.camelCase(junitReporter), 'ReporterOptions'].join('')]: {
      mochaFile: `${runCfg.resultsDir}/[suite].xml`,
      specRoot: defaultSpecRoot
    }
  };

  // Adding custom reporters
  if (runCfg && runCfg.cypress && runCfg.cypress.reporters) {
    for (const reporter of runCfg.cypress.reporters) {
      const cfgFieldName = [_.camelCase(reporter.name), 'ReporterOptions'].join('');
      reporterConfig.reporterEnabled = `${reporterConfig.reporterEnabled}, ${reporter.name}`;
      reporterConfig[cfgFieldName] = reporter.options || {};
    }
  }

  // Save reporters config
  fs.writeFileSync(path.join(__dirname, '..', 'sauce-reporter-config.json'), JSON.stringify(reporterConfig));
  return opts;
};

const getSuite = function (runCfg, suiteName) {
  const suites = runCfg.suites || [];
  const suite = suites.find((testSuite) => testSuite.name === suiteName);
  if (!suite) {
    const suiteNames = suites.map((suite) => suite.name);
    throw new Error(`Could not find suite named '${suiteName}'; available suites=${JSON.stringify(suiteNames)}`);
  }
  return suite;
};

const setEnvironmentVariables = function (runCfg, suiteName) {
  const suite = getSuite(runCfg, suiteName);
  const envVars = getEnv(suite);

  process.env.CYPRESS_SAUCE_SUITE_NAME = suite.name;
  process.env.CYPRESS_SAUCE_ARTIFACTS_DIRECTORY = runCfg.resultsDir;

  for (const [key, value] of Object.entries(envVars)) {
    process.env[key] = value;
  }
};

const getCypressOpts = function (runCfg, suiteName) {
  // Get user settings from suites.
  const suite = getSuite(runCfg, suiteName);
  const projectDir = path.dirname(getAbsolutePath(runCfg.path));

  let cypressCfgFile = path.join(projectDir, runCfg.cypress.configFile);
  if (!fs.existsSync(getAbsolutePath(cypressCfgFile))) {
    throw new Error(`Unable to locate the cypress config file. Looked for '${getAbsolutePath(cypressCfgFile)}'.`);
  }

  let headed = true;
  // suite.config.headless is kepts to keep backward compatibility.
  if (suite.headless || suite.config.headless) {
    headed = false;
  }

  let opts = {
    project: path.dirname(cypressCfgFile),
    browser: process.env.SAUCE_BROWSER || suite.browser || 'chrome',
    configFile: path.basename(cypressCfgFile),
    headed,
    headless: !headed,
    testingType: suite.config.testingType || 'e2e',
    config: {
      specPattern: suite.config.specPattern,
      excludeSpecPattern: suite.config.excludeSpecPattern || [],
      videosFolder: runCfg.resultsDir,
      screenshotsFolder: runCfg.resultsDir,
      video: shouldRecordVideo(),
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

  opts = configureReporters(runCfg, opts);
  opts = configureWebkitSupport(process.env, opts, suite);

  return opts;
};

/**
 * Setup the runner for experimental webkit support
 * @param {object} opts - Cypress options
 * @param {object} suite - The suite to run, parsed from the runner config
 */
function configureWebkitSupport (env, opts, suite) {
  // NOTE: For experimental webkit support
  // cypress uses playwright-webkit and setting PLAYWRIGHT_BROWSERS_PATH=0
  // tells playwright to look in node_modules/playwright-core/.local-browsers
  // for its browsers.
  env.PLAYWRIGHT_BROWSERS_PATH = '0';

  const browser = suite.browser ?? '';
  // NOTE: Since webkit is bundled with the runner, never use the value of process.env.SAUCE_BROWSER
  if (browser.toLowerCase().includes('webkit')) {
    opts.browser = 'webkit';
  }

  return opts;
}

const canAccessFolder = async function (file) {
  const fsAccess = util.promisify(fs.access);
  await fsAccess(file, fs.constants.R_OK | fs.constants.W_OK);
};

const cypressRunner = async function (runCfgPath, suiteName, timeoutSec, preExecTimeoutSec) {
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

  setEnvironmentVariables(runCfg, suiteName);

  let metrics = [];
  let npmMetrics = await prepareNpmEnv(runCfg);
  metrics.push(npmMetrics);
  let cypressOpts = getCypressOpts(runCfg, suiteName);
  let startTime = new Date().toISOString();
  const suites = runCfg.suites || [];
  const suite = suites.find((testSuite) => testSuite.name === suiteName);

  // Execute pre-exec steps
  if (!await preExec.run(suite, preExecTimeoutSec)) {
    let endTime = new Date().toISOString();
    await report([], 0, cypressOpts.browser, runCfg, suiteName, startTime, endTime, metrics);
    return;
  }

  // saucectl suite.timeout is in nanoseconds
  timeoutSec = suite.timeout / 1000000000 || timeoutSec;
  let timeout;
  const timeoutPromise = new Promise((resolve) => {
    timeout = setTimeout(() => {
      console.error(`Test timed out after ${timeoutSec} seconds`);
      resolve();
    }, timeoutSec * 1000);
  });

  let results = await Promise.race([timeoutPromise, cypress.run(cypressOpts)]);
  clearTimeout(timeout);
  const statusCode = results ? 0 : 1;
  let endTime = new Date().toISOString();

  return await report(results, statusCode, cypressOpts.browser, runCfg, suiteName, startTime, endTime, metrics);
};

// For dev and test purposes, this allows us to run our Cypress Runner from command line
if (require.main === module) {
  console.log(`Sauce Cypress Runner ${require(path.join(__dirname, '..', 'package.json')).version}`);
  const { runCfgPath, suiteName } = getArgs();
  // maxTimeout maximum test execution timeout is 1800 seconds (30 mins)
  const maxTimeout = 1800;
  const maxPreExecTimeout = 300;

  cypressRunner(runCfgPath, suiteName, maxTimeout, maxPreExecTimeout)
      // eslint-disable-next-line promise/prefer-await-to-then
      .then((passed) => process.exit(passed ? 0 : 1))
      // eslint-disable-next-line promise/prefer-await-to-callbacks
      .catch((err) => {
        console.log(err);
        process.exit(1);
      });
}

exports.cypressRunner = cypressRunner;
exports.configureReporters = configureReporters;
exports.getSuite = getSuite;
exports.setEnvironmentVariables = setEnvironmentVariables;
