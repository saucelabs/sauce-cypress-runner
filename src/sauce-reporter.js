const path = require('path');
const fs = require('fs');
const os = require('os');
const SauceLabs = require('saucelabs').default;
const _ = require('lodash');
const ffmpeg = require('fluent-ffmpeg');
const { promisify } = require('util');
const ffprobe = promisify(ffmpeg.ffprobe);

const { remote } = require('webdriverio');

const SauceReporter = {};

// NOTE: this function is not available currently.
// It will be ready once data store API actually works.
// Keep these pieces of code for future integration.
SauceReporter.createJobShell = async (api, testName, tags, browserName) => {
  const body = {
    name: testName,
    acl: [
      {
        type: 'username',
        value: process.env.SAUCE_USERNAME
      }
    ],
    //'start_time: startTime,
    //'end_time: endTime,
    source: 'vdc', // will use devx
    platform: 'webdriver', // will use cypress
    status: 'complete',
    live: false,
    metadata: {},
    tags,
    attributes: {
      container: false,
      browser: browserName,
      browser_version: '*',
      commands_not_successful: 1, // to be removed
      devx: true,
      os: 'test', // need collect
      performance_enabled: 'true', // to be removed
      public: 'team',
      record_logs: true, // to be removed
      record_mp4: 'true', // to be removed
      record_screenshots: 'true', // to be removed
      record_video: 'true', // to be removed
      video_url: 'test', // remove
      log_url: 'test' // remove
    }
  };

  let sessionId;
  await api.createResultJob(
    body
  ).then(
    (resp) => {
      sessionId = resp.id;
    },
    (e) => console.error('Create job failed: ', e.stack)
  );

  return sessionId || 0;
};


// TODO Tian: this method is a temporary solution for creating jobs via test-composer.
// Once the global data store is ready, this method will be deprecated.
SauceReporter.createJobWorkaround = async (api, testName, suiteName, metadata, browserName, passed, startTime, endTime) => {
  let browserVersion = '*';
  switch (browserName.toLowerCase()) {
    case 'firefox':
      browserVersion = process.env.FF_VER;
      break;
    case 'chrome':
      browserVersion = process.env.CHROME_VER;
      break;
    default:
      browserVersion = '*';
  }

  const body = {
    name: testName,
    user: process.env.SAUCE_USERNAME,
    startTime,
    endTime,
    framework: 'cypress',
    frameworkVersion: process.env.CYPRESS_VERSION,
    status: 'complete',
    suite: suiteName,
    errors: [],
    passed,
    tags: metadata.tags,
    build: metadata.build,
    browserName,
    browserVersion,
    platformName: process.env.IMAGE_NAME + ':' + process.env.IMAGE_TAG
  };

  let sessionId;
  await api.createJob(
    body
  ).then(
    (resp) => {
      sessionId = resp.ID;
    },
    (e) => console.error('Create job failed: ', e.stack)
  );

  return sessionId || 0;
};


SauceReporter.createJobLegacy = async (api, region, tld, browserName, testName, metadata) => {
  try {
    const hostname = `ondemand.${region}.saucelabs.${tld}`;
    await remote({
      user: process.env.SAUCE_USERNAME,
      key: process.env.SAUCE_ACCESS_KEY,
      region,
      tld,
      hostname,
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
          build: metadata.build,
          tags: metadata.tags,
        }
      }
    }).catch((err) => err);
  } catch (e) {
    console.error(e);
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

  return sessionId || 0;
};

SauceReporter.prepareAssets = async (specFiles, resultsFolder, metrics) => {
  const assets = [];
  const videos = [];

  // Add the main console log
  let clog = 'console.log';
  if (fs.existsSync(clog)) {
    assets.push(clog);
  }
  for (let [, mt] of Object.entries(metrics)) {
    if (_.isEmpty(mt.data)) {
      continue;
    }
    let mtFile = path.join(resultsFolder, mt.name);
    fs.writeFileSync(mtFile, JSON.stringify(mt.data, ' ', 2));
    assets.push(mtFile);
  }

  for (let specFile of specFiles) {
    const sauceAssets = [
      { name: `${specFile}.mp4`},
      { name: `${specFile}.json`},
      { name: `${specFile}.xml`},
    ];

    for (let asset of sauceAssets) {
      const assetFile = path.join(resultsFolder, asset.name);
      if (!fs.existsSync(assetFile)) {
        console.warn(`Failed to prepare asset. Could not find: '${assetFile}'`);
        continue;
      }
      assets.push(assetFile);

      if (asset.name.endsWith('.mp4')) {
        videos.push(assetFile);
      }
    }
  }

  if (videos.length !== 0) {
    let comboVideo = path.join(resultsFolder, 'video.mp4');
    try {
      await SauceReporter.mergeVideos(videos, comboVideo);
      assets.push(comboVideo);
    } catch (e) {
      console.error('Failed to merge videos: ', e);
    }
  }

  return assets;
};

SauceReporter.sauceReporter = async (runCfg, suiteName, browserName, assets, failures, startTime, endTime) => {
  const { sauce = {} } = runCfg;
  const { metadata = {} } = sauce;
  const baseTestName = metadata.name || `Test ${+new Date()}`;
  const testName = baseTestName + ' - ' + suiteName;
  const region = sauce.region || 'us-west-1';
  const tld = region === 'staging' ? 'net' : 'com';

  const api = new SauceLabs({
    user: process.env.SAUCE_USERNAME,
    key: process.env.SAUCE_ACCESS_KEY,
    region,
    tld
  });

  let sessionId;
  if (process.env.ENABLE_DATA_STORE) {
    sessionId = await SauceReporter.createJobShell(api, testName, metadata.tags, browserName);
  } else {
    sessionId = await SauceReporter.createJobWorkaround(api, testName, suiteName, metadata, browserName, failures === 0, startTime, endTime);
  }

  if (!sessionId) {
    console.error('Unable to retrieve test entry. Assets won\'t be uploaded.');
    return 'unable to retrieve test';
  }

  // upload assets
  await Promise.all([
    api.uploadJobAssets(
        sessionId,
        { files: assets },
    ).then(
        (resp) => {
          if (resp.errors) {
            for (let err of resp.errors) { console.error(err); }
          }
        },
        (e) => console.log('Upload failed:', e.stack)
    )
  ]);

  // set appropriate job status
  await Promise.all([
    api.updateJob(process.env.SAUCE_USERNAME, sessionId, {
      name: testName,
      passed: failures === 0
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
      domain = `${region}.saucelabs.${tld}`;
      break;
  }

  console.log(`\nOpen job details page: https://app.${domain}/tests/${sessionId}\n`);
};

SauceReporter.mergeVideos = async (videos, target) => {
  if (videos.length === 1 || !await SauceReporter.areVideosSameSize(videos)) {
    console.log(`Using ${videos[0]} as the main video.`);
    fs.copyFileSync(videos[0], target);
    return;
  }

  return new Promise((resolve, reject) => {
    let cmd = ffmpeg();
    console.log(`Merging videos: ${videos}, to ${target}`);
    for (let video of videos) {
      cmd.input(video);
    }
    cmd
        .on('error', function (err) {
          console.log('Failed to merge videos: ' + err.message);
          reject();
        })
        .on('end', function () {
          resolve();
        })
        .mergeToFile(target, os.tmpdir());
  });
};

SauceReporter.areVideosSameSize = async (videos) => {
  let lastSize;
  for (let video of videos) {
    let metadata;
    try {
      metadata = await ffprobe(video);
    } catch (e) {
      console.error(`Failed to inspect video ${video}, it may be corrupt: `, e);
      throw e;
    }
    let vs = metadata.streams.find((s) => s.codec_type === 'video');

    if (!lastSize) {
      lastSize = {width: vs.width, height: vs.height};
    }
    if (lastSize.width !== vs.width || lastSize.height !== vs.height) {
      console.log('Detected inconsistent video sizes.');
      return false;
    }
  }

  return true;
};

module.exports = SauceReporter;
