const path = require('path');
const fs = require('fs');
const { shouldRecordVideo, getAbsolutePath, loadRunConfig, prepareNpmEnv, getArgs, getEnv, preExec } = require('sauce-testrunner-utils');
const cypress = require('cypress');
const util = require('util');

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

  const testingType = suite.config.testingType || 'e2e';

  let opts = {
    project: path.dirname(cypressCfgFile),
    browser: process.env.SAUCE_BROWSER || suite.browser || 'chrome',
    configFile: path.basename(cypressCfgFile),
    headed,
    headless: !headed,
    testingType,
    config: {
      [testingType]: {
        specPattern: suite.config.specPattern,
        excludeSpecPattern: suite.config.excludeSpecPattern || [],
      },
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

  configureWebkitOptions(process.env, opts, suite);

  return opts;
};

/**
 * Configure the runner for experimental webkit support
 * @param {object} opts - Cypress options
 * @param {object} suite - The suite to run, parsed from the runner config
 */
function configureWebkitOptions (env, opts, suite) {
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
}

const canAccessFolder = async function (file) {
  const fsAccess = util.promisify(fs.access);
  await fsAccess(file, fs.constants.R_OK | fs.constants.W_OK);
};

const cypressRunner = async function (nodeBin, runCfgPath, suiteName, timeoutSec, preExecTimeoutSec) {
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

  // Define node/npm path for execution
  const npmBin = process.env.NPM_CLI_PATH || path.join(path.dirname(nodeBin), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  const nodeCtx = { nodePath: nodeBin, npmPath: npmBin };

  let metrics = [];
  let npmMetrics = await prepareNpmEnv(runCfg, nodeCtx);
  metrics.push(npmMetrics);
  let cypressOpts = getCypressOpts(runCfg, suiteName);
  const suites = runCfg.suites || [];
  const suite = suites.find((testSuite) => testSuite.name === suiteName);

  // Execute pre-exec steps
  if (!await preExec.run(suite, preExecTimeoutSec)) {
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
  const failures = results.failures || results.totalFailed;
  const passed = failures === 0 && statusCode === 0;

  // try {
  //   const reportJSON = await afterRunTestReport(results);
  //   if (reportJSON) {
  //     const filepath = path.join(runCfg.resultsDir, 'sauce-test-report.json');
  //     reportJSON.toFile(filepath);
  //   }
  // } catch (e) {
  //   console.error('Failed to serialize test results: ', e);
  // }

  return passed;
};

// For dev and test purposes, this allows us to run our Cypress Runner from command line
if (require.main === module) {
  const packageInfo = require(path.join(__dirname, '..', 'package.json'));
  console.log(`Sauce Cypress Runner ${packageInfo.version}`);
  console.log(`Running Cypress ${packageInfo.dependencies?.cypress || ''}`);
  const { nodeBin, runCfgPath, suiteName } = getArgs();
  // maxTimeout maximum test execution timeout is 1800 seconds (30 mins)
  const maxTimeout = 1800;
  const maxPreExecTimeout = 300;

  cypressRunner(nodeBin, runCfgPath, suiteName, maxTimeout, maxPreExecTimeout)
      // eslint-disable-next-line promise/prefer-await-to-then
      .then((passed) => process.exit(passed ? 0 : 1))
      // eslint-disable-next-line promise/prefer-await-to-callbacks
      .catch((err) => {
        console.log(err);
        process.exit(1);
      });
}

exports.cypressRunner = cypressRunner;
exports.getSuite = getSuite;
exports.setEnvironmentVariables = setEnvironmentVariables;
