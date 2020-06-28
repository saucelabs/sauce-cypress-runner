const SauceLabs = require('saucelabs').default
const region = process.env.SAUCE_REGION || 'us-west-1'
const api = new SauceLabs({
  user: process.env.SAUCE_USERNAME,
  key: process.env.SAUCE_ACCESS_KEY,
  region: region
});

const { remote } = require('webdriverio');
const path = require('path')

exports.sauceReporter = async (browserName, assets, results) => {
  let testName  = `devx cypress ${(new Date().getTime())}`
  console.log(testName);
  let status = results === 0;
  try {
    let browser = await remote({
      user: process.env.SAUCE_USERNAME,
      key: process.env.SAUCE_ACCESS_KEY,
      region: region,
      connectionRetryCount: 0,
      logLevel: 'silent',
      capabilities: {
          browserName: browserName,
          platformName: '*',
          browserVersion: '*',
          'sauce:options': {
              devX: true,
              name: testName,
              framework: 'cypress'
          }
      }
    }).catch((err) => err)
  } catch(e) {
    console.log(e);
  }
  try {
    const { jobs } = await api.listJobs(
      process.env.SAUCE_USERNAME,
      { limit: 1, full: true, name: testName }
    )
    sessionId = jobs && jobs.length && jobs[0].id
  } catch (e) {
    console.warn("Failed to prepare test", e);
  }
  // create sauce asset
  console.log('Preparing assets');
  let uploadAssets = [...assets];
  // updaload assets
  await Promise.all([
    api.uploadJobAssets(
      sessionId,
      uploadAssets
    ).then(
      () => console.log('upload successful'),
      (e) => console.log('upload failed:', e.stack)
    ),
    api.updateJob(process.env.SAUCE_USERNAME, sessionId, {
      name: testName,
      passed: results === 0 ? true : false
    }).then(
      () => {},
      (e) => console.log('Failed to update job status', e)
    )
  ])

  let domain

  switch (region) {
    case "us-west-1":
      domain = "saucelabs.com"
      break
    default:
      domain = `${region}.saucelabs.com`
  }

  console.log(`\nOpen job details page: https://app.${domain}/tests/${sessionId}\n`);
}