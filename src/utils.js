const path = require('path');
const yaml = require('js-yaml');
const fs = require('fs');
const { promisify } = require('util');

const readFile = promisify(fs.readFile);

function getAbsolutePath (pathToDir) {
  if (path.isAbsolute(pathToDir)) {
    return pathToDir;
  }
  return path.join(process.cwd(), pathToDir);
};

async function getRunnerConfig () {
  // Get the configuration info from config.yaml
  const configYamlDefault = 'config.yaml';
  const configYamlPath = process.env.CONFIG_FILE || configYamlDefault;
  const config = yaml.safeLoad(await readFile(configYamlPath, 'utf8'));

  // If relative paths were provided in YAML, convert them to absolute
  const rootDir = process.env.SAUCE_ROOT_DIR || config.rootDir;
  const reportsDir = process.env.SAUCE_REPORTS_DIR || config.reportsDir;
  const targetDir = process.env.SAUCE_TARGET_DIR || config.targetDir;
  
  return {
    rootDir,
    reportsDir,
    targetDir,
  };
};

function shouldRecordVideo () {
  let isVideoRecording = process.env.SAUCE_CYPRESS_VIDEO_RECORDING;
  if (isVideoRecording === undefined) {
    return true;
  }
  let videoOption = String(isVideoRecording).toLowerCase();
  return videoOption === 'true' || videoOption === '1';
}

module.exports.getAbsolutePath = getAbsolutePath;
module.exports.shouldRecordVideo = shouldRecordVideo;
module.exports.getRunnerConfig = getRunnerConfig;
