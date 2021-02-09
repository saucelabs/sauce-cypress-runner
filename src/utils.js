const path = require('path');
const fs = require('fs');
const _ = require('lodash');
const childProcess = require('child_process');
const yargs = require('yargs/yargs');

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

async function installDependencies (runCfg) {
  const npmConfig = runCfg && runCfg.npm && runCfg.npm.packages || {};
  const packageList = Object.entries(npmConfig).map(([pkg, version]) => `${pkg}@${version}`);

  if (packageList.length === 0) {
    return;
  }

  const p = new Promise((resolve, reject) => {
    const nodeBin = process.platform === 'win32' ? 'node.exe' : 'node';
    const nodePath = path.join(__dirname, '..', nodeBin);
    const npmCli = path.join(__dirname, '..', 'node_modules', 'npm', 'bin', 'npm-cli');
    const npmArgs = ['install', '--no-save', ...packageList];
    const procArgs = process.env.SAUCE_VM ?
      [nodePath, npmCli, ...npmArgs] :
      ['npm', ...npmArgs];
    console.log(`Running npm install on ${npmArgs.join(', ')}`);
    const child = childProcess.spawn(procArgs[0], procArgs.slice(1));
    child.stdout.pipe(process.stdout);
    child.stderr.pipe(process.stderr);
    child.on('exit', (exitCode) => {
      if (exitCode === 0) {
        resolve();
      } else {
        reject(`Could not install NPM dependencies`);
      }
    });
  });
  return await p;
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
// nested/example.test.js/screenshot.png will be renamed to nested__screenshot.png
// screenshot.png will not be renamed and stay screenshot.png
function renameScreenshot (specFile, oldFilePath, folderName, fileName) {
  const splittedSpecFile = specFile.split('/');
  if (splittedSpecFile.length < 2) {
    return oldFilePath;
  }
  let prefix = splittedSpecFile.slice(0, splittedSpecFile.length - 1).join('__');
  let newName = path.join(folderName, prefix + '__' + fileName);
  fs.renameSync(oldFilePath, newName);
  return newName;
}

// renameAsset renames asset.
// nested/example.test.js.xml will be renamed to nested__example.test.js.xml
// example.test.js.xml will not be renamed and stay example.test.js.xml
function renameAsset (specFile, oldFilePath, resultsFolder) {
  const splittedSpecFile = specFile.split('/');
  if (splittedSpecFile.length < 2) {
    return oldFilePath;
  }
  // create new file name
  let newFile = splittedSpecFile.slice(0, splittedSpecFile.length).join('__');
  let nestedPath = splittedSpecFile.slice(0, splittedSpecFile.length - 1).join('/');
  let newFilePath = path.join(resultsFolder, nestedPath, newFile);
  fs.renameSync(oldFilePath, newFilePath);
  return newFilePath;
}

module.exports = {
  getAbsolutePath, shouldRecordVideo, loadRunConfig,
  installDependencies, getArgs, getEnv, getSuite, renameScreenshot, renameAsset
};
