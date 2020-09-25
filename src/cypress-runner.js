const { sauceReporter }   = require('./sauce-reporter');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const yaml = require('js-yaml');
const cypress = require('cypress');
let glob = require('glob');
let { exec } = require('child_process');
const { getAbsolutePath } = require('./utils');

// Promisify the callback functions
const fileExists = promisify(fs.exists);
const readFile = promisify(fs.readFile);
exec = promisify(exec);
glob = promisify(glob);

// the default test matching behavior for versions <= v0.1.8
const DefaultRunCfg = {
  projectPath: `/home/seluser/cypress/integration`,
  match: [
    `**/?(*.)+(spec|test).[jt]s?(x)`
  ]
}

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

async function loadRunConfig(cfgPath) {
  if (await fileExists(cfgPath)) {
    return yaml.safeLoad(await readFile(cfgPath, 'utf8'));
  }
  console.log(`Run config (${cfgPath}) unavailable. Loading defaults.`)

  // the default test matching behavior for versions <= v0.1.8
  return DefaultRunCfg
}

const report = async (results) => {
  const status = results.failures || results.totalFailed;
  if (!(process.env.SAUCE_USERNAME && process.env.SAUCE_ACCESS_KEY)) {
    console.log('Skipping asset uploads! Remember to setup your SAUCE_USERNAME/SAUCE_ACCESS_KEY');
    return status;
  }
  const runs = results.runs || [];
  for(let spec of runs) {
    await sauceReporter(buildName, browserName, spec);
  };
  return status;
}

const cypressRunner = async function () {
  try {
    // Get the configuration info from config.yaml
    const configYamlPath = process.env.CONFIG_FILE || 'config.yaml';
    const config = yaml.safeLoad(await readFile(configYamlPath, 'utf8'));

    // If relative paths were provided in YAML, convert them to absolute
    const reportsDir = getAbsolutePath(config.reportsDir);

    const runCfgPath = path.join(config.rootDir, 'run.yaml')
    const runCfg = await loadRunConfig(runCfgPath)

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
    const cypressRunConfig = {
      browser: browserName,
      configFile,
      config: {
        env,
        video: true,
        videosFolder: reportsDir,
        videoCompression: false,
        videoUploadOnPasses: false,
        screenshotsFolder: reportsDir,
        integrationFolder: runCfg.projectPath,
        testFiles: runCfg.match,
        reporter: "cypress-multi-reporters",
        reporterOptions: {
          mochaFile: `${reportsDir}/[suite].xml`,
          configFile: 'src/reporter-config.json'
        }
      }
    };
    const results = await cypress.run(cypressRunConfig);

    const status = await report(results);
    process.exit(status);
  }catch (err) {
    console.log(err);
    process.exit(1);
  }
}

// For dev and test purposes, this allows us to run our Cypress Runner from command line
if (require.main === module) {
  cypressRunner();
}

exports.cypressRunner = cypressRunner