let { exec } = require('child_process');
const path = require('path');
let { get, request } = require('https');
const { promisify } = require('bluebird');
const axios = require('axios');

const u = process.env.GITHUB_USERNAME;
const t = process.env.GITHUB_TOKEN;
const auth = `${u}:${t}`;

async function uploadGithubRelease (tag, file) {
    const url = `https://${auth}@api.github.com/repos/saucelabs/sauce-cypress-runner/releases/tags/${tag}`;
    const res = await axios.get(url);
    console.log(res.data.id);
};

if (require.main === module) {
  let tag = process.env.GH_TAG || 'v0.1.9';
  let file = process.env.GH_FILE;
  uploadGithubRelease(tag, file);
    /*.then(() => process.exit(0))
    .catch(() => process.exit(1));*/
}