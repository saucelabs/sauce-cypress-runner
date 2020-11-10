const path = require('path');
const fs = require('fs');
const os = require('os');
const SauceLabs = require('saucelabs').default;
const { getRunnerConfig } = require('./utils');
let md5 = require('md5');
const ffmpeg = require('fluent-ffmpeg');
const { promisify } = require('util');
const ffprobe = promisify(ffmpeg.ffprobe);
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


SauceReporter.prepareAssets = async (specFiles, resultsFolder) => {
  const assets = [];
  const videos = [];

  // Add the main console log
  const {rootDir} = await getRunnerConfig();
  let clog = path.join(rootDir, 'console.log');
  if (fs.existsSync(clog)) {
    assets.push(clog);
  }

  for (let specFile of specFiles) {
    const tmpFolder = fs.mkdtempSync(path.join(os.tmpdir(), md5(specFile)));
    const specFilename = path.basename(specFile);
    const sauceAssets = [
      { name: `${specFilename}.mp4`, ext: 'mp4' },
      { name: `${specFilename}.json`, ext: 'json' },
      { name: `${specFilename}.xml`, ext: 'xml' },
    ];

    for (let ast of sauceAssets) {
      let assetFile = await SauceReporter.prepareAsset(specFile, resultsFolder, tmpFolder, ast.ext, ast.name);
      if (assetFile) {
        assets.push(assetFile);

        if (ast.ext === 'mp4') {
          videos.push(assetFile);
        }
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

SauceReporter.sauceReporter = async (buildName, browserName, assets, failures) => {
  // SAUCE_JOB_NAME is only available for saucectl >= 0.16, hence the fallback
  let testName = process.env.SAUCE_JOB_NAME || `DevX Cypress Test Run - ${(new Date()).getTime()}`;
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

  if (undefined === sessionId || 0 === sessionId) {
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
    let vs = metadata.streams.find(s => s.codec_type === 'video');

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