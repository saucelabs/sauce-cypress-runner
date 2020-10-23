const path = require('path');

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
  return String(isVideoRecording).toLowerCase() === 'true';
}

module.exports.getAbsolutePath = getAbsolutePath;
module.exports.shouldRecordVideo = shouldRecordVideo;