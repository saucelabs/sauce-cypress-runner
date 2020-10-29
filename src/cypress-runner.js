const { sauceReporter } = require('./sauce-reporter');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const { getRunnerConfig, shouldRecordVideo } = require('./utils');
const yaml = require('js-yaml');
const cypress = require('cypress');
let { exec } = require('child_process');

// Promisify the callback functions
const fileExists = promisify(fs.exists);
const readFile = promisify(fs.readFile);
exec = promisify(exec);

const DEFAULT_BROWSER = 'chrome';
const supportedBrowsers = {
  'chrome': 'chrome',
  'firefox': 'firefox'
};

// the default test matching behavior for versions <= v0.1.8
const DefaultRunCfg = {
  match: [
    `**/?(*.)+(spec|test).[jt]s?(x)`
  ]
};

async function loadRunConfig (cfgPath) {
  if (await fileExists(cfgPath)) {
    return yaml.safeLoad(await readFile(cfgPath, 'utf8'));
  }
  console.log(`Run config (${cfgPath}) unavailable. Loading defaults.`);

  // the default test matching behavior for versions <= v0.1.8
  return DefaultRunCfg;
}

const report = async (results, browserName) => {
  const status = results.failures || results.totalFailed;
  if (!(process.env.SAUCE_USERNAME && process.env.SAUCE_ACCESS_KEY)) {
    console.log('Skipping asset uploads! Remember to setup your SAUCE_USERNAME/SAUCE_ACCESS_KEY');
    return status;
  }
  const runs = results.runs || [];
  const buildName = process.env.SAUCE_BUILD_NAME || `stt-cypress-build-${(new Date()).getTime()}`;
  for (let spec of runs) {
    await sauceReporter(buildName, browserName, spec);
  }
  return status;
};

const cypressRunner = async function () {
  // Determine the browser (Chrome by default)
  let browserName;
  browserName = process.env.BROWSER_NAME || DEFAULT_BROWSER;
  browserName = supportedBrowsers[browserName.toLowerCase()];
  if (!browserName) {
    throw new Error(`Unsupported browser: '${process.env.BROWSER_NAME}'. Sorry.`);
  }

  // If browser path was provided, use that and append browser name
  // (e.g.: C:/user/path/to/browser:chrome)
  let browser;
  if (process.env.SAUCE_BROWSER_PATH) {
    browser = `${process.env.SAUCE_BROWSER_PATH}:${browserName}`;
  } else {
    browser = browserName;
  }

  // Get the configuration info from config.yaml
  const {rootDir, reportsDir, targetDir} = await getRunnerConfig();

  const runCfgPath = path.join(rootDir, 'run.yaml');
  const runCfg = await loadRunConfig(runCfgPath);

  if (!runCfg.projectPath) {
    runCfg.projectPath = targetDir;
  }

  // If a typescript config is found in the project path, then compile with it
  const tsconfigPath = path.join(runCfg.projectPath, 'tsconfig.json');

  if (await fileExists(tsconfigPath)) {
    console.log(`Compiling Typescript files from tsconfig '${tsconfigPath}'`);
    await exec(`npx tsc -p "${tsconfigPath}"`);
  }

  // Get the cypress.json config file (https://docs.cypress.io/guides/references/configuration.html#Options)
  let configFile = 'cypress.json';
  let cypressJsonPath = path.join(runCfg.projectPath, 'cypress.json');
  if (await fileExists(cypressJsonPath)) {
    configFile = path.relative(process.cwd(), cypressJsonPath);
  }

  // Get the cypress env variables from 'cypress.env.json' (if present)
  let env = {};
  const cypressEnvPath = path.join(runCfg.projectPath, 'cypress.env.json');
  if (await fileExists(cypressEnvPath)) {
    try {
      env = JSON.parse(await readFile(cypressEnvPath));
    } catch (e) {
      console.error(`Could not parse contents of '${cypressEnvPath}'. Will use empty object for environment variables.`);
    }
  }

  const results = await cypress.run({
    browser,
    configFile,
    config: {
      env,
      video: shouldRecordVideo(),
      videosFolder: reportsDir,
      videoCompression: false,
      videoUploadOnPasses: false,
      screenshotsFolder: reportsDir,
      integrationFolder: runCfg.projectPath,
      testFiles: runCfg.match,
      reporter: 'src/custom-reporter.js',
      reporterOptions: {
        mochaFile: `${reportsDir}/[suite].xml`,
        specFolder: runCfg.projectPath,
      },
    }
  });
  return await report(results, browserName);
};

// For dev and test purposes, this allows us to run our Cypress Runner from command line
if (require.main === module) {
  cypressRunner()
      // eslint-disable-next-line promise/prefer-await-to-then
      .then((status) => process.exit(status))
      // eslint-disable-next-line promise/prefer-await-to-callbacks
      .catch((err) => {
        console.log(err);
        process.exit(1);
      });
}

exports.cypressRunner = cypressRunner;
