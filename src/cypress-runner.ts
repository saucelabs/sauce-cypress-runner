import { sauceReporter, prepareAssets } from './sauce-reporter';
import path from 'path';
import fs from 'fs';
const { shouldRecordVideo, getAbsolutePath, loadRunConfig, prepareNpmEnv, getArgs, getEnv, preExec } = require('sauce-testrunner-utils');
import cypress from 'cypress';
import util from 'util';
import _ from 'lodash';
import { afterRunTestReport } from '@saucelabs/cypress-plugin';

import { RunConfig, Results, CypressConfig, Suite } from './types';

const report = async (results: CypressCommandLine.CypressRunResult, statusCode: number, browserName: string, runCfg: RunConfig, suiteName: string, startTime: string, endTime: string, metrics: any[]) => {
  // Prepare the assets
  const runs = results.runs || [];
  let specFiles = runs.map((run) => path.basename(run.spec.name));

  let failures = results.totalFailed;
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
    const reportJSON = await afterRunTestReport(results as unknown as CypressCommandLine.CypressRunResult);
    if (reportJSON) {
      const filepath = path.join(runCfg.resultsDir, 'sauce-test-report.json');
      reportJSON.toFile(filepath);
      assets.push(filepath);
    }
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
const configureReporters = function (runCfg: RunConfig, opts: any) {
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

const getSuite = function (runCfg: RunConfig, suiteName: string) {
  const suites = runCfg.suites || [];
  const suite = suites.find((testSuite) => testSuite.name === suiteName);
  if (!suite) {
    const suiteNames = suites.map((suite) => suite.name);
    throw new Error(`Could not find suite named '${suiteName}'; available suites=${JSON.stringify(suiteNames)}`);
  }
  return suite;
};

const setEnvironmentVariables = function (runCfg: RunConfig, suiteName: string) {
  const suite = getSuite(runCfg, suiteName);
  const envVars = getEnv(suite);

  process.env.CYPRESS_SAUCE_SUITE_NAME = suite.name;
  process.env.CYPRESS_SAUCE_ARTIFACTS_DIRECTORY = runCfg.resultsDir;

  for (const [key, value] of Object.entries(envVars)) {
    process.env[key] = value as string;
  }
};

const getCypressOpts = function (runCfg: RunConfig, suiteName: string) {
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

  let opts: CypressConfig = {
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

  opts = configureReporters(runCfg, opts);
  configureWebkitOptions(process.env, opts, suite);

  return opts;
};

/**
 * Configure the runner for experimental webkit support
 * @param {object} opts - Cypress options
 * @param {object} suite - The suite to run, parsed from the runner config
 */
function configureWebkitOptions (env: NodeJS.ProcessEnv, opts: CypressConfig, suite: Suite) {
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

const canAccessFolder = async function (file: string) {
  const fsAccess = util.promisify(fs.access);
  await fsAccess(file, fs.constants.R_OK | fs.constants.W_OK);
};

const cypressRunner = async function (nodeBin: string, runCfgPath: string, suiteName: string, timeoutSec: number, preExecTimeoutSec: number): Promise<boolean> {
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
  let startTime = new Date().toISOString();
  const suites = runCfg.suites || [];
  const suite = suites.find((testSuite) => testSuite.name === suiteName);

  // Execute pre-exec steps
  if (!await preExec.run(suite, preExecTimeoutSec)) {
    let endTime = new Date().toISOString();
    await report({} as CypressCommandLine.CypressRunResult, 0, cypressOpts.browser, runCfg, suiteName, startTime, endTime, metrics);
    return;
  }

  // saucectl suite.timeout is in nanoseconds
  timeoutSec = suite.timeout / 1000000000 || timeoutSec;
  let timeout: NodeJS.Timeout;
  const timeoutPromise = new Promise((resolve) => {
    timeout = setTimeout(() => {
      console.error(`Test timed out after ${timeoutSec} seconds`);
      resolve(false);
    }, timeoutSec * 1000);
  });

  let results = await Promise.race([timeoutPromise, cypress.run(cypressOpts as CypressCommandLine.CypressRunOptions)]);
  clearTimeout(timeout);
  const statusCode = results ? 0 : 1;
  let endTime = new Date().toISOString();

  return await report(results as CypressCommandLine.CypressRunResult, statusCode, cypressOpts.browser, runCfg, suiteName, startTime, endTime, metrics);
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
exports.configureReporters = configureReporters;
exports.getSuite = getSuite;
exports.setEnvironmentVariables = setEnvironmentVariables;
