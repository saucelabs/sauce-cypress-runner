const util = require('util');

const NPM = {};

NPM.install = async function install (...args) {
  const npmInstall = util.promisify(require('npm').install);
  await npmInstall(...args);
};

NPM.load = async function load (...args) {
  const npmLoad = util.promisify(require('npm').load);
  await npmLoad(...args);
};

module.exports = NPM;

