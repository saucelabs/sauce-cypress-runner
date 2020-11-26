const path = require('path');
const fs = require('fs');
const os = require('os');
const SauceLabs = require('saucelabs').default;
const ffmpeg = require('fluent-ffmpeg');
const { promisify } = require('util');
const ffprobe = promisify(ffmpeg.ffprobe);

const { remote } = require('webdriverio');

const SauceReporter = {};

SauceReporter.prepareAssets = async (specFiles, resultsFolder) => {
  const assets = [];
  const videos = [];

  // Add the main console log
  let clog = 'console.log';
  if (fs.existsSync(clog)) {
    assets.push(clog);
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

  const api = new SauceLabs({
    user: process.env.SAUCE_USERNAME,
    key: process.env.SAUCE_ACCESS_KEY,
    region
  });

  let sessionId;

  if (process.env.ENABLE_PLATFORM === true) {
    const body = {
      'name': testName,
      'acl': [
        {
          'type': 'username',
          'value': process.env.SAUCE_USERNAME
        }
      ],
      'start_time': startTime,
      'end_time': endTime,
      'source': 'vdc', // will use devx
      'platform': 'webdriver', // will use cypress
      'status': 'complete',
      'live': false,
      'metadata': {},
      'attributes': {
        'container': false,
        'browser': browserName,
        'commands_not_successful': 1, // to be removed
        'devx': true,
        'os': 'test', // need collect
        'performance_enabled': 'true', // to be removed
        'public': 'team',
        'record_logs': true, // to be removed
        'record_mp4': 'true', // to be removed
        'record_screenshots': 'true', // to be removed
        'record_video': 'true', // to be removed
        'video_url': 'test', // remove
        'log_url': 'test' // remove
      }
    };

    await Promise.all([
      api.createResultJob(
        body
      ).then(
        (resp) => {
          sessionId = resp.id;
        },
        (e) => console.error('Create job failed: ', e.stack)
      )
    ]);
  } else {
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
            build: metadata.build,
            tags: metadata.tags,
          }
        }
      }).catch((err) => err);
    } catch (e) {
      console.log(e);
    }

    try {
      const { jobs } = await api.listJobs(
        process.env.SAUCE_USERNAME,
        { limit: 1, full: true, name: testName }
      );
      sessionId = jobs && jobs.length && jobs[0].id;
    } catch (e) {
      console.warn('Failed to prepare test', e);
    }

    if (undefined === sessionId || 0 === sessionId) {
      console.error('Unable to retrieve test entry. Assets won\'t be uploaded.');
      return 'unable to retrieve test';
    }
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
      domain = `${region}.saucelabs.com`;
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