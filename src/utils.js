const path = require('path');
const fs = require('fs');

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

module.exports = { getAbsolutePath, shouldRecordVideo, loadRunConfig };
