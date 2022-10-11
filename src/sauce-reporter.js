const path = require('path');
const fs = require('fs');
const os = require('os');
const _ = require('lodash');
const ffmpeg = require('fluent-ffmpeg');
const {promisify} = require('util');
const ffprobe = promisify(ffmpeg.ffprobe);
const {updateExportedValue} = require('sauce-testrunner-utils').saucectl;
const {shouldRecordVideo, escapeXML} = require('sauce-testrunner-utils');
const convert = require('xml-js');
const {TestComposer} = require('@saucelabs/testcomposer');
const SauceReporter = {};

// Path has to match the value of the Dockerfile label com.saucelabs.job-info !
SauceReporter.SAUCECTL_OUTPUT_FILE = '/tmp/output.json';

SauceReporter.createJob = async (testComposer, suiteName, metadata, browserName, passed, startTime, endTime) => {
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

  let job;
  await testComposer.createReport({
    name: suiteName,
    startTime,
    endTime,
    framework: 'cypress',
    frameworkVersion: this.cypressDetails?.cypressVersion || '0.0.0',
    passed,
    tags: metadata.tags,
    build: metadata.build,
    browserName,
    browserVersion,
    platformName: process.env.IMAGE_NAME + ':' + process.env.IMAGE_TAG,
  }).then(
    (resp) => {
      job = resp;
    },
    (e) => console.error('Create job failed: ', e.stack)
  );

  return job;
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

  try {
    SauceReporter.mergeJunitFile(specFiles, resultsFolder, testName, browserName, platformName);
  } catch (e) {
    console.error(`Failed to generate junit file: ${e}: `);
  }

  for (let specFile of specFiles) {
    const sauceAssets = [
      {name: `${path.basename(specFile)}.mp4`},
      {name: `${path.basename(specFile)}.json`},
      {name: `${path.basename(specFile)}.xml`},
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
  const {sauce = {}} = runCfg;
  const {metadata = {}} = sauce;
  const region = sauce.region || 'us-west-1';

  let pkgVersion = 'unknown';
  try {
    const pkgData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));
    pkgVersion = pkgData.version;
    // eslint-disable-next-line no-empty
  } catch (e) {
  }

  const testComposer = new TestComposer({
    username: process.env.SAUCE_USERNAME,
    accessKey: process.env.SAUCE_ACCESS_KEY,
    region,
    headers: {'User-Agent': `cypress-runner/${pkgVersion}`}
  });

  let job = await SauceReporter.createJob(testComposer, suiteName, metadata, browserName, failures === 0, startTime, endTime);

  if (!job) {
    console.error('Failed to report tests. Assets won\'t be uploaded.');
    updateExportedValue(SauceReporter.SAUCECTL_OUTPUT_FILE, {reportingSucceeded: false});
    return;
  }

  const assetStreams = assets.map((filepath) => ({
    filename: path.basename(filepath),
    data: fs.createReadStream(filepath)
  }));

  // upload assets
  await testComposer.uploadAssets(
    job.id,
    assetStreams
  ).then(
    (resp) => {
      if (resp.errors) {
        for (const err of resp.errors) {
          console.error('Failed to upload asset:', err);
        }
      }
    },
    (e) => console.error('Failed to upload assets:', e.message)
  );

  console.log(`\nOpen job details page: ${job.url}\n`);
  updateExportedValue(SauceReporter.SAUCECTL_OUTPUT_FILE, {jobDetailsUrl: job.url, reportingSucceeded: !!job});
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

  let opts = {compact: true, spaces: 4};
  let testsuites = [];
  for (let i = 0; i < specFiles.length; i++) {
    const xmlData = fs.readFileSync(path.join(resultsFolder, `${specFiles[i]}.xml`), 'utf8');
    const jsObj = convert.xml2js(xmlData, opts);
    if (jsObj.testsuites && jsObj.testsuites.testsuite) {
      testsuites.push(...jsObj.testsuites.testsuite);
    }
  }
  if (testsuites.length === 0) {
    return;
  }

  let totalTests = 0;
  let totalErr = 0;
  let totalFailure = 0;
  let totalDisabled = 0;
  let totalTime = 0.0000;
  for (let ts of testsuites) {
    if (ts._attributes) {
      totalTests += +ts._attributes.tests || 0;
      totalFailure += +ts._attributes.failures || 0;
      totalTime += +ts._attributes.time || 0.0000;
      totalErr += +ts._attributes.error || 0;
      totalDisabled += +ts._attributes.disabled || 0;
    }
  }

  let result = {
    testsuites: {
      testsuite: testsuites.filter((item) => item._attributes?.name !== 'Root Suite'),
      _attributes: {
        name: testName,
        tests: totalTests,
        failures: totalFailure,
        time: totalTime,
        error: totalErr,
        disabled: totalDisabled,
      }
    }
  };

  for (let i = 0; i < result.testsuites.testsuite.length; i++) {
    const testcase = result.testsuites.testsuite[i].testcase;

    // _attributes
    result.testsuites.testsuite[i]._attributes = result.testsuites.testsuite[i]._attributes || {};
    result.testsuites.testsuite[i]._attributes.id = i;

    // failure message
    if (testcase && testcase.failure) {
      result.testsuites.testsuite[i].testcase.failure._attributes = {
        message: escapeXML(testcase.failure._attributes.message || ''),
        type: testcase.failure._attributes.type || ''
      };
      result.testsuites.testsuite[i].testcase.failure._cdata = testcase.failure._cdata || '';
    }

    // properties
    result.testsuites.testsuite[i].properties = {
      property: [
        {
          _attributes: {
            name: 'platformName',
            value: getPlatformName(platformName),
          }
        },
        {
          _attributes: {
            name: 'browserName',
            value: getBrowsername(browserName),
          }
        }
      ]
    };
  }

  opts.textFn = escapeXML;
  let xmlResult = convert.js2xml(result, opts);
  fs.writeFileSync(path.join(resultsFolder, 'junit.xml'), xmlResult);
};

const getPlatformName = (platformName) => {
  if (process.platform.toLowerCase() === 'linux') {
    platformName = 'Linux';
  }

  return platformName;
};

const getBrowsername = (browserName) => {
  const browsers = browserName.split(':');
  if (browsers.length > 0) {
    browserName = browsers[browsers.length - 1];
  }

  return browserName;
};

module.exports = SauceReporter;
