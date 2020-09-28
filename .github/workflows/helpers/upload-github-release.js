let { exec } = require('child_process');
const path = require('path');
const { promisify } = require('bluebird');

exec = promisify(exec);

async function uploadGithubRelease (tag, file) {
    const githubRelease = path.join(process.env.GOPATH, 'bin', 'github-release');
    console.log('Uploading to GitHub releases');
    await exec(`${githubRelease} upload --user saucelabs --repo sauce-cypress-runner ` +
      `--tag ${tag} --name ${file} --file ${file}`);
    console.log('Done releasing to GitHub');
};

if (require.main === module) {
  let [,, tag, file] = process.argv;
  tag = tag || 'v0.1.9'; // Hardcoding for testing purposes
  uploadGithubRelease(tag, file)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}