const path = require('path');
const fs = require('fs');
const childProcess = require('child_process');

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

function loadRunConfig (cfgPath) {
  if (fs.existsSync(cfgPath)) {
    return require(cfgPath);
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
      [path.join(path.dirname(process.argv[0]), 'npm'), ...npmArgs];
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

module.exports = { getAbsolutePath, shouldRecordVideo, loadRunConfig, installDependencies };
