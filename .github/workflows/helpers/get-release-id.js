const axios = require('axios');

async function getReleaseId (tag) {
    const url = `https://api.github.com/repos/saucelabs/sauce-cypress-runner/releases/tags/${tag}`;
    console.log(`Release URL ${url}`);
    const res = await axios.get(url);
    console.log(res.data.id);
};

if (require.main === module) {
  let ref = process.env.GH_REF;
  let [,type,value] = ref.split('/');
  if (type != 'tag') {
    value = 'v0.1.9'; // <-- for testing purposes
  }
  console.log(`Getting release id for tag '${value}'`);
  getReleaseId(value)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}