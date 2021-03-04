const path = require('path');
const fs = require('fs');
const _ = require('lodash');
const yargs = require('yargs/yargs');
const npm = require('./npm');

const DEFAULT_REGISTRY = 'https://registry.npmjs.org';

function getAbsolutePath (pathToDir) {
  if (path.isAbsolute(pathToDir)) {
    return pathToDir;
  }
  return path.join(process.cwd(), pathToDir);
}

function shouldRecordVideo () {
  let isVideoRecording = process.env.SAUCE_CYPRESS_VIDEO_RECORDING;
  if (isVideoRecording === undefined) {
    return true;
  }
  let videoOption = String(isVideoRecording).toLowerCase();
  return videoOption === 'true' || videoOption === '1';
}

let runConfig = null;

function loadRunConfig (cfgPath) {
  if (runConfig) {
    return runConfig;
  }
  if (fs.existsSync(cfgPath)) {
    runConfig = require(cfgPath);
    return runConfig;
  }
  throw new Error(`Runner config (${cfgPath}) unavailable.`);
}

function getDefaultRegistry () {
  return process.env.SAUCE_NPM_CACHE || DEFAULT_REGISTRY;
}

async function setUpNpmConfig (registry) {
  console.log('Preparing npm environment');
  await npm.load({
    registry,
    retry: { retries: 3 },
    json: false,
    save: false,
    audit: false,
    rollback: false,
    fund: false
  });
}

async function installNpmDependencies (packageList) {
  console.log(`\nInstalling packages: ${packageList.join(' ')}`);
  await npm.install(...packageList);
}

async function prepareNpmEnv (runCfg) {
  const npmMetrics = {
    name: 'npm_metrics.json', data: {}
  };
  const npmConfig = runCfg && runCfg.npm && runCfg.npm.packages || {};
  const packageList = Object.entries(npmConfig).map(([pkg, version]) => `${pkg}@${version}`);
  if (packageList.length === 0) {
    return npmMetrics;
  }
  // prepares npm config
  const registry = runCfg.npm.registry || getDefaultRegistry();
  let startTime = (new Date()).getTime();
  await setUpNpmConfig(registry);
  let endTime = (new Date()).getTime();
  npmMetrics.data.setup = {duration: endTime - startTime};

  // install npm packages
  npmMetrics.data.install = {};
  startTime = (new Date()).getTime();
  await installNpmDependencies(packageList);
  endTime = (new Date()).getTime();
  npmMetrics.data.install = {duration: endTime - startTime};
  return npmMetrics;
}

let args = null;

function getArgs () {
  if (args) {
    return args;
  }
  const argv = yargs(process.argv.slice(2))
    .command('$0', 'the default command')
    .option('runCfgPath', {
      alias: 'r',
      type: 'string',
      description: 'Path to sauce runner json',
    })
    .option('suiteName', {
      alias: 's',
      type: 'string',
      description: 'Select the suite to run'
    })
    .demandOption(['runCfgPath', 'suiteName'])
    .argv;
  const { runCfgPath, suiteName } = argv;
  const nodeBin = process.argv[0];
  args = { nodeBin, runCfgPath, suiteName };
  return args;
}

function getEnv (suite) {
  let env = {};
  if (_.isObject(suite.env)) {
    env = {...env, ...suite.env};
  }
  if (_.isObject(suite.config) && _.isObject(suite.config.env)) {
    env = {...env, ...suite.config.env};
  }
  // If the variable starts with $, pull that environment variable from the process
  for (const [name, value] of _.toPairs(env)) {
    if (value.startsWith('$')) {
      env[name] = process.env[value.slice(1)];
    }
  }
  return env;
}

function getSuite (runConfig, suiteName) {
  return runConfig.suites.find((testSuite) => testSuite.name === suiteName);
}

// renameScreenshot renames screenshot.
// nested/example.test.js/screenshot.png will be renamed to nested__example.test.js__screenshot.png
// example.test.js/screenshot.png will be renamed to example.test.js__screenshot.png
function renameScreenshot (specFile, oldFilePath, folderName, fileName) {
  let newName = path.join(folderName, specFile.replace(path.sep, '__') + '__' + fileName);
  fs.renameSync(oldFilePath, newName);
  return newName;
}

// renameAsset renames asset.
// nested/example.test.js.xml will be renamed to nested__example.test.js.xml
// example.test.js.xml will not be renamed and stay example.test.js.xml
function renameAsset ({specFile, oldFilePath, resultsFolder}) {
  const splittedSpecFile = specFile.split(path.sep);
  if (splittedSpecFile.length < 2) {
    return oldFilePath;
  }
  // create new file name
  let newFile = splittedSpecFile.slice(0, splittedSpecFile.length).join('__');
  let newFilePath = path.join(resultsFolder, newFile);
  fs.renameSync(oldFilePath, newFilePath);
  return newFilePath;
}

module.exports = {
  getAbsolutePath, shouldRecordVideo, loadRunConfig,
  prepareNpmEnv, setUpNpmConfig, installNpmDependencies,
  getArgs, getEnv, getSuite, renameScreenshot, renameAsset,
};
