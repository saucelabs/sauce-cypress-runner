let { exec } = require('child_process');
const path = require('path');
const { promisify } = require('bluebird');

exec = promisify(exec);

async function uploadGithubRelease (tag, file) {
    const githubRelease = path.join(process.env.GOPATH, 'bin', 'github-release');
    console.log(`Uploading to GitHub releases: tag=${tag} file=${file}`);
    try {
        await exec(`${githubRelease} upload --user saucelabs --repo sauce-cypress-runner ` +
          `--tag ${tag} --name ${file} --file ${file}`);
    } catch (e) {
        console.error(`An error was thrown: ${e}`);
        throw e;
    }
    console.log('Done releasing to GitHub');
};

if (require.main === module) {
  console.log(`Go path is '${process.env.GOPATH}'`);
  let tag = process.env.GH_TAG || 'v0.1.9';
  console.log(`Making release for tag: ${tag}`);
  let file = process.env.GH_FILE;
  console.log(`Releasing file: ${file}`);
  uploadGithubRelease(tag, file)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}