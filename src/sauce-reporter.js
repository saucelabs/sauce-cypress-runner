const path = require('path');
const fs = require('fs');
const os = require('os');
const SauceLabs = require('saucelabs').default;
let md5 = require('md5');
const region = process.env.SAUCE_REGION || 'us-west-1';

const { remote } = require('webdriverio');

const SauceReporter = {};

SauceReporter.prepareAsset = (specFile, resultsFolder, tmpFolder, ext, name) => {
  // Sauce only accepts file with certain names, otherwise the UI doesnt show them
  // why copy them ? we also want to show the reports locally so changing name
  // could generate conflicts
  const assetFile = path.join(resultsFolder, `${specFile}.${ext}`);
  try {
    if (fs.existsSync(assetFile)) {
      const assetTmpFile = path.join(tmpFolder, name);
      fs.copyFileSync(assetFile, assetTmpFile);
      return assetTmpFile;
    }
  } catch (e) {}
  console.warn(`Could not find: '${assetFile}'`);
  return null;
};

SauceReporter.prepareAssets = async (specFile, resultsFolder) => {
  const tmpFolder = fs.mkdtempSync(path.join(os.tmpdir(), md5(specFile)));
  const sauceAssets = [
    { name: 'video.mp4', ext: 'mp4' },
    { name: 'log.json', ext: 'json' },
    { name: 'junit.xml', ext: 'xml' },
  ];
  const assets = [];
  for (let ast of sauceAssets) {
    let assetFile = await SauceReporter.prepareAsset(specFile, resultsFolder, tmpFolder, ast.ext, ast.name);
    if (assetFile) {
      assets.push(assetFile);
    }
  }
  return assets;
};

SauceReporter.sauceReporter = async (buildName, browserName, spec) => {
  let specFile = spec.spec.name;
  let testName = `devx cypress - ${specFile}`;
  let tags = process.env.SAUCE_TAGS;

  const api = new SauceLabs({
    user: process.env.SAUCE_USERNAME,
    key: process.env.SAUCE_ACCESS_KEY,
    region
  });

  if (tags) {
    tags = tags.split(',');
  }
  try {
    await remote({
      user: process.env.SAUCE_USERNAME,
      key: process.env.SAUCE_ACCESS_KEY,
      region,
      connectionRetryCount: 0,
      logLevel: 'silent',
      capabilities: {
        browserName,
        platformName: '*',
        browserVersion: '*',
        'sauce:options': {
          devX: true,
          name: testName,
          framework: 'cypress',
          build: buildName,
          tags
        }
      }
    }).catch((err) => err);
  } catch (e) {
    console.log(e);
  }

  let sessionId;
  try {
    const { jobs } = await api.listJobs(
      process.env.SAUCE_USERNAME,
      { limit: 1, full: true, name: testName }
    );
    sessionId = jobs && jobs.length && jobs[0].id;
  } catch (e) {
    console.warn('Failed to prepare test', e);
  }

  // create sauce asset
  console.log(`Preparing assets for ${specFile}`);
  let assets = await SauceReporter.prepareAssets(
    specFile,
    process.env.SAUCE_REPORTS_DIR || 'cypress/results'
  );

  // upload assets
  await Promise.all([
    api.uploadJobAssets(
      sessionId,
      { files: assets },
    ).then(
      (resp) => {
        if (resp.errors) {
          for (let err of resp.errors) { console.warn(err); }
        }
      },
      (e) => console.log('upload failed:', e.stack)
    ),
    api.updateJob(process.env.SAUCE_USERNAME, sessionId, {
      name: testName,
      passed: spec.stats.failures === 0 ? true : false
    }).then(
      () => {},
      (e) => console.log('Failed to update job status', e)
    )
  ]);

  let domain;

  switch (region) {
    case 'us-west-1':
      domain = 'saucelabs.com';
      break;
    default:
      domain = `${region}.saucelabs.com`;
      break;
  }

  console.log(`\nOpen job details page: https://app.${domain}/tests/${sessionId}\n`);

};

module.exports = SauceReporter;