const axios = require('axios');

/**
 * Get the release associated with a tag and print the release ID to console
 * @param {string} tag 
 */
async function printReleaseId (tag) {
    const url = `https://api.github.com/repos/saucelabs/sauce-cypress-runner/releases/tags/${tag}`;
    const res = await axios.get(url);
    console.log(res.data.id);
};

if (require.main === module) {
  let ref = process.env.GH_REF;
  let [,type,value] = ref.split('/');
  if (type != 'tag') {
    value = 'v0.1.9'; // <-- for testing purposes
  }
  printReleaseId(value)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}