import path from 'path';
import fs from 'fs';
import {
  shouldRecordVideo,
  getAbsolutePath,
  loadRunConfig,
  prepareNpmEnv,
  getArgs,
  getEnv,
  preExec,
  zip,
} from 'sauce-testrunner-utils';
import cypress from 'cypress';
import util from 'util';
import _ from 'lodash';
import { afterRunTestReport } from '@saucelabs/cypress-plugin';
import { createJUnitReport } from '@saucelabs/cypress-junit-plugin';
import { clearTimeout, setTimeout } from 'timers';

import { RunConfig, Suite } from './types';

async function report(
  results:
    | CypressCommandLine.CypressRunResult
    | CypressCommandLine.CypressFailedRunResult,
  runCfg: RunConfig,
) {
  try {
    createJUnitReport(results, {
      filename: path.join(runCfg.resultsDir, 'junit.xml'),
    });
  } catch (e) {
    console.warn('Skipping JUnit file generation:', e);
  }

  try {
    const reportJSON = await afterRunTestReport(results);
    if (reportJSON) {
      const filepath = path.join(runCfg.resultsDir, 'sauce-test-report.json');
      reportJSON.toFile(filepath);
    }
  } catch (e) {
    console.error('Failed to serialize test results:', e);
  }

  if (isFailedRunResult(results)) {
    return false;
  }

  return results.totalFailed === 0;
}

function isFailedRunResult(
  maybe:
    | CypressCommandLine.CypressRunResult
    | CypressCommandLine.CypressFailedRunResult,
): maybe is CypressCommandLine.CypressFailedRunResult {
  return (
    (maybe as CypressCommandLine.CypressFailedRunResult).status === 'failed'
  );
}

// Configure reporters
function configureReporters(runCfg: RunConfig, opts: any) {
  const reporterConfig = {
    reporterEnabled: `spec`,
  };

  // Adding custom reporters
  if (runCfg && runCfg.cypress && runCfg.cypress.reporters) {
    for (const reporter of runCfg.cypress.reporters) {
      const cfgFieldName = [_.camelCase(reporter.name), 'ReporterOptions'].join(
        '',
      );
      reporterConfig.reporterEnabled = `${reporterConfig.reporterEnabled}, ${reporter.name}`;
      reporterConfig[cfgFieldName] = reporter.options || {};
    }
  }

  const reporterConfigPath = path.join(
    __dirname,
    '..',
    'sauce-reporter-config.json',
  );

  // Save reporters config
  fs.writeFileSync(reporterConfigPath, JSON.stringify(reporterConfig));

  // Cypress only supports a single reporter out of the box, so we need to use
  // a plugin to support multiple reporters.
  opts.config.reporter = path.join(
    __dirname,
    '../node_modules/cypress-multi-reporters/lib/MultiReporters.js',
  );
  opts.config.reporterOptions = {
    configFile: reporterConfigPath,
  };

  return opts;
}

function getSuite(runCfg: RunConfig, suiteName: string) {
  const suites = runCfg.suites || [];
  const suite = suites.find((testSuite) => testSuite.name === suiteName);
  if (!suite) {
    const suiteNames = suites.map((suite) => suite.name);
    throw new Error(
      `Could not find suite named '${suiteName}'; available suites=${JSON.stringify(
        suiteNames,
      )}`,
    );
  }
  return suite;
}

function setEnvironmentVariables(runCfg: RunConfig, suiteName: string) {
  const suite = getSuite(runCfg, suiteName);
  const envVars = getEnv(suite);

  process.env.CYPRESS_SAUCE_SUITE_NAME = suite.name;
  process.env.CYPRESS_SAUCE_ARTIFACTS_DIRECTORY = runCfg.resultsDir;
  process.env.SAUCE_WEB_ASSETS_DIR =
    suite.config?.env?.SAUCE_SYNC_WEB_ASSETS?.toLowerCase() === 'true'
      ? runCfg.resultsDir
      : '';

  for (const [key, value] of Object.entries(envVars)) {
    process.env[key] = value as string;
  }
}

function getCypressOpts(
  runCfg: RunConfig,
  suiteName: string,
): CypressCommandLine.CypressRunOptions {
  // Get user settings from suites.
  const suite = getSuite(runCfg, suiteName);
  const projectDir = path.dirname(getAbsolutePath(runCfg.path));

  const cypressCfgFile = path.join(projectDir, runCfg.cypress.configFile);
  if (!fs.existsSync(getAbsolutePath(cypressCfgFile))) {
    throw new Error(
      `Unable to locate the cypress config file. Looked for '${getAbsolutePath(
        cypressCfgFile,
      )}'.`,
    );
  }

  let headed = true;
  // suite.config.headless is kept to keep backward compatibility.
  if (suite.headless || suite.config.headless) {
    headed = false;
  }

  const testingType = suite.config.testingType || 'e2e';
  const cypressOutputDir =
    suite.config?.env?.SAUCE_SYNC_WEB_ASSETS?.toLowerCase() === 'true'
      ? undefined
      : runCfg.resultsDir;

  let opts: Partial<CypressCommandLine.CypressRunOptions> = {
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
      videosFolder: cypressOutputDir,
      screenshotsFolder: cypressOutputDir,
      video: shouldRecordVideo(),
      videoCompression: false,
      env: getEnv(suite),
    },
  };

  if (runCfg.cypress.record && runCfg.cypress.key !== undefined) {
    opts.record = runCfg.cypress.record;
    opts.key = runCfg.cypress.key;
  }

  if (runCfg.cypress.reporters && runCfg.cypress.reporters.length > 0) {
    opts = configureReporters(runCfg, opts);
    console.log(
      'Configuring reporters with saucectl is deprecated and will be removed in a future release. Migrate your configuration to your cypress config file.',
    );
  }
  configureWebkitOptions(process.env, opts, suite);

  return opts as CypressCommandLine.CypressRunOptions;
}

/**
 * Configure the runner for experimental webkit support
 * @param env - Environment variables
 * @param {object} opts - Cypress options
 * @param {object} suite - The suite to run, parsed from the runner config
 */
function configureWebkitOptions(
  env: NodeJS.ProcessEnv,
  opts: Partial<CypressCommandLine.CypressRunOptions>,
  suite: Suite,
) {
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

async function canAccessFolder(file: string) {
  const fsAccess = util.promisify(fs.access);
  await fsAccess(file, fs.constants.R_OK | fs.constants.W_OK);
}

function zipArtifacts(runCfg: RunConfig) {
  if (!runCfg.artifacts || !runCfg.artifacts.retain) {
    return;
  }
  const archivesMap = runCfg.artifacts.retain;
  Object.keys(archivesMap).forEach((source) => {
    const dest = path.join(runCfg.resultsDir, archivesMap[source]);
    try {
      zip(path.dirname(runCfg.path), source, dest);
    } catch (err) {
      console.error(
        `Zip file creation failed for destination: "${dest}", source: "${source}". Error: ${err}.`,
      );
    }
  });
}

async function cypressRunner(
  nodeBin: string,
  runCfgPath: string,
  suiteName: string,
  timeoutSec: number,
  preExecTimeoutSec: number,
): Promise<boolean> {
  runCfgPath = getAbsolutePath(runCfgPath);
  const runCfg = loadRunConfig(runCfgPath) as RunConfig;
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
  const npmBin =
    process.env.NPM_CLI_PATH ||
    path.join(
      path.dirname(nodeBin),
      'node_modules',
      'npm',
      'bin',
      'npm-cli.js',
    );
  const nodeCtx = { nodePath: nodeBin, npmPath: npmBin };

  await prepareNpmEnv(runCfg, nodeCtx);
  const cypressOpts = getCypressOpts(runCfg, suiteName);
  const suites = runCfg.suites || [];
  const suite = suites.find((testSuite) => testSuite.name === suiteName);

  // Execute pre-exec steps
  if (!(await preExec.run(suite, preExecTimeoutSec))) {
    return false;
  }

  // saucectl suite.timeout is in nanoseconds
  timeoutSec = suite.timeout / 1000000000 || timeoutSec;
  let timeout: NodeJS.Timeout;
  const timeoutPromise: Promise<CypressCommandLine.CypressFailedRunResult> =
    new Promise((resolve) => {
      timeout = setTimeout(() => {
        console.error(`Test timed out after ${timeoutSec} seconds`);
        resolve({
          status: 'failed',
          failures: 1,
          message: `Test timed out after ${timeoutSec} seconds`,
        });
      }, timeoutSec * 1000);
    });

  const results = await Promise.race([
    timeoutPromise,
    cypress.run(cypressOpts),
  ]);
  clearTimeout(timeout);
  zipArtifacts(runCfg);

  return await report(results, runCfg);
}

// For dev and test purposes, this allows us to run our Cypress Runner from command line
if (require.main === module) {
  const packageInfo = require(path.join(__dirname, '..', 'package.json'));
  console.log(`Sauce Cypress Runner ${packageInfo.version}`);
  console.log(`Running Cypress ${packageInfo.dependencies?.cypress || ''}`);

  const { nodeBin, runCfgPath, suiteName } = getArgs();
  const timeoutSec = 1800; // 30 min
  const preExecTimeoutSec = 300; // 5 min

  cypressRunner(nodeBin, runCfgPath, suiteName, timeoutSec, preExecTimeoutSec)
    .then((passed) => process.exit(passed ? 0 : 1))
    .catch((err) => {
      console.log(err);
      process.exit(1);
    });
}
