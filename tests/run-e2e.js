const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const projectsDir = './tests/fixtures/projects/';
const dirs = fs.readdirSync(projectsDir);

for (const dir of dirs) {
  if (dir.endsWith('-tests')) {
    let projectDir = path.join(process.cwd(), projectsDir, dir);
    let SAUCE_CTL_BINARY = process.env.SAUCE_CTL_BINARY;
    if (!path.isAbsolute(SAUCE_CTL_BINARY)) {
      SAUCE_CTL_BINARY = path.join(process.cwd(), process.env.SAUCE_CTL_BINARY);
    }
    execSync(`${SAUCE_CTL_BINARY} run`, {cwd: projectDir, stdio: 'inherit'});
  }
}