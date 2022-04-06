const path = require('path');
const fs = require('fs');
const os = require('os');
const SauceLabs = require('saucelabs').default;
const _ = require('lodash');
const ffmpeg = require('fluent-ffmpeg');
const { promisify } = require('util');
const ffprobe = promisify(ffmpeg.ffprobe);
const { updateExportedValue } = require('sauce-testrunner-utils').saucectl;
const { shouldRecordVideo, escapeXML } = require('sauce-testrunner-utils');
const convert = require('xml-js');

const SauceReporter = {};

// Path has to match the value of the Dockerfile label com.saucelabs.job-info !
SauceReporter.SAUCECTL_OUTPUT_FILE = '/tmp/output.json';


// NOTE: this function is not available currently.
// It will be ready once data store API actually works.
// Keep these pieces of code for future integration.
SauceReporter.createJobShell = async (api, suiteName, tags, browserName) => {
  const body = {
    name: suiteName,
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
SauceReporter.createJobWorkaround = async (api, suiteName, metadata, browserName, passed, startTime, endTime, saucectlVersion) => {
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
    name: suiteName,
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
    platformName: process.env.IMAGE_NAME + ':' + process.env.IMAGE_TAG,
    saucectlVersion,
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

SauceReporter.prepareAssets = async (specFiles, resultsFolder, metrics, testName, browserName, platformName) => {
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

  SauceReporter.mergeJunitFile(specFiles, resultsFolder, testName, browserName, platformName);

  for (let specFile of specFiles) {
    const sauceAssets = [
      { name: `${specFile}.mp4`},
      { name: `${specFile}.json`},
      { name: `${specFile}.xml`},
    ];


    // screenshotsFolder has the same name as spec file name
    const screenshotsFolder = path.join(resultsFolder, specFile);
    if (fs.existsSync(screenshotsFolder)) {
      const screenshotPaths = fs.readdirSync(screenshotsFolder);
      screenshotPaths.forEach((file) => {
        let screenshot = path.join(screenshotsFolder, file);
        assets.push(screenshot);
      });
    }

    for (let asset of sauceAssets) {
      let assetFile = path.join(resultsFolder, asset.name);
      if (!fs.existsSync(assetFile)) {
        if (assetFile.endsWith('.mp4') && shouldRecordVideo()) {
          console.warn(`Failed to prepare asset. Could not find: '${assetFile}'`);
        }
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

  let junitPath = path.join(resultsFolder, 'junit.xml');
  if (fs.existsSync(junitPath)) {
    assets.push(junitPath);
  }

  return assets;
};

SauceReporter.sauceReporter = async (runCfg, suiteName, browserName, assets, failures, startTime, endTime) => {
  const { sauce = {} } = runCfg;
  const { metadata = {} } = sauce;
  const region = sauce.region || 'us-west-1';
  const tld = region === 'staging' ? 'net' : 'com';
  const saucectlVersion = process.env.SAUCE_SAUCECTL_VERSION;

  const api = new SauceLabs({
    user: process.env.SAUCE_USERNAME,
    key: process.env.SAUCE_ACCESS_KEY,
    region,
    tld
  });

  let reportingSucceeded = false;
  let sessionId;
  if (process.env.ENABLE_DATA_STORE) {
    sessionId = await SauceReporter.createJobShell(api, suiteName, metadata.tags, browserName);
  } else {
    sessionId = await SauceReporter.createJobWorkaround(api, suiteName, metadata, browserName, failures === 0, startTime, endTime, saucectlVersion);
  }

  if (!sessionId) {
    console.error('Unable to retrieve test entry. Assets won\'t be uploaded.');
    updateExportedValue(SauceReporter.SAUCECTL_OUTPUT_FILE, { reportingSucceeded });
    return;
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
      name: suiteName,
      passed: failures === 0
    }).then(
        () => {},
        (e) => console.log('Failed to update job status', e)
    )
  ]);
  reportingSucceeded = true;

  let domain;

  switch (region) {
    case 'us-west-1':
      domain = 'saucelabs.com';
      break;
    default:
      domain = `${region}.saucelabs.${tld}`;
      break;
  }

  const jobDetailsUrl = `https://app.${domain}/tests/${sessionId}`;
  console.log(`\nOpen job details page: ${jobDetailsUrl}\n`);

  updateExportedValue(SauceReporter.SAUCECTL_OUTPUT_FILE, { jobDetailsUrl, reportingSucceeded });
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

SauceReporter.mergeJunitFile = (specFiles, resultsFolder, testName, browserName, platformName) => {
  if (specFiles.length === 0) {
    return;
  }
  let result;
  let totalTests = 0;
  let totalErr = 0;
  let totalFailure = 0;
  let totalDisabled = 0;
  let totalTime = 0.0000;
  let opts = {compact: true, spaces: 4};
  try {
    const xmlData = fs.readFileSync(path.join(resultsFolder, `${specFiles[0]}.xml`), 'utf8');
    result = convert.xml2js(xmlData, opts);
    for (let i = 1; i < specFiles.length; i++) {
      let jsObj;
      const xmlData = fs.readFileSync(path.join(resultsFolder, `${specFiles[i]}.xml`), 'utf8');
      jsObj = convert.xml2js(xmlData, opts);
      result.testsuites.testsuite.push(...jsObj.testsuites.testsuite);
    }

    if (!result.testsuites || !result.testsuites.testsuite) {
      return;
    }

    for (let ts of result.testsuites?.testsuite) {
      totalTests += +ts._attributes.tests || 0;
      totalFailure += +ts._attributes.failures || 0;
      totalTime += +ts._attributes.time || 0.0000;
      totalErr += +ts._attributes.error || 0;
      totalDisabled += +ts._attributes.disabled || 0;
    }
    result.testsuites._attributes.name = testName;
    result.testsuites._attributes.tests = totalTests;
    result.testsuites._attributes.failures = totalFailure;
    result.testsuites._attributes.time = totalTime;
    result.testsuites._attributes.error = totalErr;
    result.testsuites._attributes.disabled = totalDisabled;
    result.testsuites.testsuite = result.testsuites.testsuite.filter((item) => item._attributes.name !== 'Root Suite');
    if (process.platform.toLowerCase() === 'linux') {
      platformName = 'Linux';
    }
    const browsers = browserName.split(':');
    if (browsers.length > 0) {
      browserName = browsers[browsers.length - 1];
    }
    for (let i = 0; i < result.testsuites.testsuite.length; i++) {
      const testcase = result.testsuites.testsuite[i].testcase;
      result.testsuites.testsuite[i]._attributes.id = i;
      result.testsuites.testsuite[i].properties = {};
      if (testcase && testcase.failure) {
        result.testsuites.testsuite[i].testcase.failure._attributes.message = escapeXML(testcase.failure._attributes.message || '');
        result.testsuites.testsuite[i].testcase.failure._attributes.type = testcase.failure._attributes.type || '';
        result.testsuites.testsuite[i].testcase.failure._cdata = testcase.failure._cdata || '';
      }
      result.testsuites.testsuite[i].properties.property = [

        {
          _attributes: {
            name: 'platformName',
            value: platformName,
          }
        },
        {
          _attributes: {
            name: 'browserName',
            value: browserName,
          }
        }
      ];
    }

    opts.textFn = escapeXML;
    let xmlResult = convert.js2xml(result, opts);
    fs.writeFileSync(path.join(resultsFolder, 'junit.xml'), xmlResult);
  } catch (err) {
    console.error('failed to generate junit file:', err);
  }
};

module.exports = SauceReporter;
