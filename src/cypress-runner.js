const { sauceReporter, prepareAssets } = require('./sauce-reporter');
const path = require('path');
const fs = require('fs');
const { shouldRecordVideo, getAbsolutePath, loadRunConfig, prepareNpmEnv, getArgs, getEnv } = require('sauce-testrunner-utils');
const cypress = require('cypress');
const util = require('util');
const _ = require('lodash');

const report = async (results, browserName, runCfg, suiteName, startTime, endTime, metrics) => {
  // Prepare the assets
  const runs = results.runs || [];
  let specFiles = runs.map((run) => run.spec.name);

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
  // Run in cloud mode
  if (process.env.SAUCE_VM) {
    return failures === 0;
  }
  if (!(process.env.SAUCE_USERNAME && process.env.SAUCE_ACCESS_KEY)) {
    console.log('Skipping asset uploads! Remember to setup your SAUCE_USERNAME/SAUCE_ACCESS_KEY');
    return failures === 0;
  }
  // Run in docker mode
  if (process.env.SAUCE_USERNAME !== '' && process.env.SAUCE_ACCESS_KEY !== '') {
    await sauceReporter(runCfg, suiteName, browserName, assets, failures, startTime, endTime);
  }

  return failures === 0;
};

// Configure reporters
const configureReporters = function (cypressCfg, runCfg, opts) {
  // Enable cypress-multi-reporters plugin
  opts.config.reporter = path.join(__dirname, '../node_modules/cypress-multi-reporters/lib/MultiReporters.js');
  opts.config.reporterOptions = {
    configFile: path.join(__dirname, '..', 'sauce-reporter-config.json'),
  };

  const customReporter = path.join(__dirname, '../src/custom-reporter.js');
  const junitReporter = path.join(__dirname, '../node_modules/mocha-junit-reporter/index.js');

  // Referencing "mocha-junit-reporter" using relative path will allow to have multiple instance of mocha-junit-reporter.
  // That permits to have a configuration specific to us, and in addition to keep customer's one.
  let reporterConfig = {
    reporterEnabled: `spec, ${customReporter}, ${junitReporter}`,
    [[_.camelCase(customReporter), 'ReporterOptions'].join('')]: {
      mochaFile: `${runCfg.resultsDir}/[suite].xml`,
      specRoot: cypressCfg.integrationFolder || 'cypress/integration'
    },
    [[_.camelCase(junitReporter), 'ReporterOptions'].join('')]: {
      mochaFile: `${runCfg.resultsDir}/[suite].xml`,
      specRoot: cypressCfg.integrationFolder || 'cypress/integration'
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

const getCypressOpts = function (runCfg, suiteName) {
  // Get user settings from suites.
  const suites = runCfg.suites || [];
  const suite = suites.find((testSuite) => testSuite.name === suiteName);
  if (!suite) {
    const suiteNames = suites.map((suite) => suite.name);
    throw new Error(`Could not find suite named '${suiteName}'; available suites='${JSON.stringify(suiteNames)}`);
  }

  const projectDir = path.dirname(getAbsolutePath(runCfg.path));

  let cypressCfgFile = path.join(projectDir, runCfg.cypress.configFile);
  if (!fs.existsSync(getAbsolutePath(cypressCfgFile))) {
    throw new Error(`Unable to locate the cypress config file. Looked for '${getAbsolutePath(cypressCfgFile)}'.`);
  }

  const cypressCfg = JSON.parse(fs.readFileSync(cypressCfgFile, 'utf8'));

  let headed = true;
  if (suite.config.headless) {
    headed = false;
  }

  let opts = {
    project: path.dirname(cypressCfgFile),
    browser: process.env.SAUCE_BROWSER || suite.browser || 'chrome',
    configFile: path.basename(cypressCfgFile),
    headed,
    headless: !headed,
    config: {
      testFiles: suite.config.testFiles,
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

  opts = configureReporters(cypressCfg, runCfg, opts);

  _.defaultsDeep(opts.config, suite.config);
  return opts;
};

const canAccessFolder = async function (file) {
  const fsAccess = util.promisify(fs.access);
  await fsAccess(file, fs.constants.R_OK | fs.constants.W_OK);
};

const cypressRunner = async function (runCfgPath, suiteName) {
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
  const results = await cypress.run(cypressOpts);
  let endTime = new Date().toISOString();

  return await report(results, cypressOpts.browser, runCfg, suiteName, startTime, endTime, metrics);
};

// For dev and test purposes, this allows us to run our Cypress Runner from command line
if (require.main === module) {
  console.log(`Sauce Cypress Runner ${require(path.join(__dirname, '..', 'package.json')).version}`);
  const { runCfgPath, suiteName } = getArgs();

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
exports.configureReporters = configureReporters;
