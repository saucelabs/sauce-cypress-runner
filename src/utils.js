const path = require('path');

function getAbsolutePath(pathToDir) {
  if (path.isAbsolute(pathToDir)) {
    return pathToDir;
  }
  return path.join(process.cwd(), pathToDir);
}

module.exports.getAbsolutePath = getAbsolutePath;