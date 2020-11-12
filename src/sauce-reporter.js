const path = require('path');
const fs = require('fs');
const os = require('os');
const axios = require('axios');
const SauceLabs = require('saucelabs').default;
const ffmpeg = require('fluent-ffmpeg');
const { promisify } = require('util');
const ffprobe = promisify(ffmpeg.ffprobe);
const readdir = promisify(fs.readdir);
const fsStat = promisify(fs.stat);
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


SauceReporter.prepareAssets = async (cypressRunObj) => {
  const assets = [];
  const { videosFolder, screenshotsFolder } = cypressRunObj.config;
  const { resultsFolder, project } = cypressRunObj;

  let pathToProject = process.cwd();
  if (project) {
    pathToProject = path.join(pathToProject, project);
  }

  const videosFolderFullPath = path.join(pathToProject, videosFolder);
  if (await fsStat(videosFolderFullPath)) {
    for (const video of await readdir(videosFolderFullPath)) {
      assets.push(path.join(videosFolderFullPath, video));
    }
  }

  /*for (const screenshot of await readdir(path.join(pathToProject, screenshotsFolder))) {
    assets.push(screenshot);
  }*/

  const resultsPath = path.join(pathToProject, resultsFolder);
  for (const result of await readdir(resultsPath)) {
    assets.push(path.join(resultsPath, result));
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
    let ondemandUrl; 
    let region;
    if (!region || region === 'us' || region === 'us-west-1') {
      region = 'us-west-1';
      ondemandUrl = 'ondemand.saucelabs.com';
    } else if (region === 'eu-central-1' || region === 'eu') {
      region = 'eu-central-1';
      ondemandUrl = 'ondemand.eu-central-1.saucelabs.com';
    }
    const newSessionUrl = `https://${process.env.SAUCE_USERNAME}:${process.env.SAUCE_ACCESS_KEY}@${ondemandUrl}/wd/hub/session`;
    const res = await axios.post(newSessionUrl, {
      desiredCapabilities: {
        browserName,
        browserVersion: '*',
        platformName: '*',
        name: testName,
        'sauce:options': {
          devX: true,
          framework: 'cypress',
          build: buildName,
          tags: []
        }
      },
    });
    console.log('@@@@DONE', res);
  } catch (e) {
    console.log(e);
    console.log('*****');
  }
  let sessionId;
  try {
    const jobsUrl = `https://api.${region}.saucelabs.com/rest/v1.1/${process.env.SAUCE_USERNAME}/jobs?limit=1&full=true&name=${testName}`;
    const { data } = await axios.get(jobsUrl, {
      auth: {
        username: process.env.SAUCE_USERNAME,
        password: process.env.SAUCE_ACCESS_KEY,
      }
    });
    const { jobs } = data;
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