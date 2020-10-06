const { execSync } = require('child_process');
const path = require('path');
const glob = require('glob-fs')();

const dirs = glob.readdirSync(path.join('tests', 'fixtures', 'projects', '*-tests/'));

for (const dir of dirs) {
  const SAUCE_CTL_BINARY = process.env.SAUCE_CTL_BINARY;
  execSync(`${SAUCE_CTL_BINARY} run`, {cwd: path.join(process.cwd(), dir), stdio: 'inherit'});
}