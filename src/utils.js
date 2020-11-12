const path = require('path');
const yaml = require('js-yaml');
const fs = require('fs');
const { promisify } = require('util');
const _ = require('lodash');

const readFile = promisify(fs.readFile);

function getAbsolutePath (pathToDir) {
  if (path.isAbsolute(pathToDir)) {
    return pathToDir;
  }
  return path.join(process.cwd(), pathToDir);
}

let config;

async function getRunnerConfig () {
  // Get the configuration info from config.yaml
  const configYamlDefault = 'config.yaml';
  const configYamlPath = process.env.SAUCE_CONFIG_FILE || configYamlDefault;
  if (!config) {
    config = yaml.safeLoad(await readFile(configYamlPath, 'utf8'));
  }

  // If relative paths were provided in YAML, convert them to absolute
  const rootDir = process.env.SAUCE_ROOT_DIR || config.rootDir;
  const reportsDir = process.env.SAUCE_REPORTS_DIR || config.reportsDir;
  const targetDir = process.env.SAUCE_TARGET_DIR || process.env.SAUCE_ROOT_DIR || config.targetDir;

  return {
    rootDir,
    reportsDir,
    targetDir,
  };
}

function shouldRecordVideo () {
  let isVideoRecording = process.env.SAUCE_CYPRESS_VIDEO_RECORDING;
  if (isVideoRecording === undefined) {
    return true;
  }
  let videoOption = String(isVideoRecording).toLowerCase();
  return videoOption === 'true' || videoOption === '1';
}

function getCypressConfigObject (runJson, suiteName) {
  const cwd = process.cwd();
  let defaultCypressConfig = {
    browser: 'chrome',
    project: cwd, // If project not specified, assume it's wherever the process is being run
  };
  let cypressConfig = _.defaultsDeep(runJson.cypress, defaultCypressConfig);

  if (suiteName) {
    const suites = runJson.suites || [];
    const suite = _.find(suites, (testSuite) => testSuite.name === suiteName);
    if (!suite) {
      throw new Error(`Could not find suite named '${suiteName}'; suites='${suites}`);
    }
    cypressConfig = _.defaultsDeep(suite, cypressConfig);
  }
  if (!cypressConfig.config) {
    cypressConfig.config = {};
  }

  const resultsFolder = path.join('__assets__');

  // Whatever the user provides is overridden by these
  const mandatoryCypressSettings = {
    resultsFolder, // not used by cypress, used by us
    config: {
      videosFolder: resultsFolder,
      screenshotsFolder: resultsFolder,
      video: shouldRecordVideo(),
      reporter: path.join(cwd, 'src', 'custom-reporter.js'),
      reporterOptions: {
        mochaFile: `${resultsFolder}/[suite].xml`,
        specFolder: `${resultsFolder}/`,
        specRoot: cypressConfig.config.integrationFolder || 'cypress/integration',
      },
      videoCompression: false,
      videoUploadOnPasses: false,
    }
  };
  cypressConfig = _.defaultsDeep(mandatoryCypressSettings, cypressConfig);

  return cypressConfig;
}

module.exports = { getAbsolutePath, shouldRecordVideo, getRunnerConfig, getCypressConfigObject };
