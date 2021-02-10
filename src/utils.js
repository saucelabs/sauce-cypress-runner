const path = require('path');
const fs = require('fs');
const _ = require('lodash');
const yargs = require('yargs/yargs');
const util = require('util');
const npm = require('npm');

const DefaultRegistry = process.env.SAUCE_NPM_CACHE || 'https://registry.npmjs.org';

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


async function setUpRegistry (registry) {
  const npmLoad = util.promisify(npm.load);
  await npmLoad({
    registry,
    retry: {
      retries: 3
    }
  });
}

async function installDependencies (runCfg) {
  const npmConfig = runCfg && runCfg.npm && runCfg.npm.packages || {};
  const packageList = Object.entries(npmConfig).map(([pkg, version]) => `${pkg}@${version}`);

  if (packageList.length === 0) {
    return;
  }
  const registry = runCfg.npm.registry || DefaultRegistry;
  await setUpRegistry(registry);
  const npmInstall = util.promisify(npm.install);
  for (let pkg of packageList) {
    console.log(`Installing package: ${pkg}`);
    await npmInstall(pkg);
  }
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

module.exports = {
  getAbsolutePath, shouldRecordVideo, loadRunConfig,
  installDependencies, getArgs, getEnv, getSuite
};
