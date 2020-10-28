jest.mock('fs');
jest.mock('webdriverio');
jest.mock('saucelabs');
jest.mock('../../../src/utils');
const fs = require('fs');
const webdriverio = require('webdriverio');
const SauceLabs = require('saucelabs');
const utils = require('../../../src/utils');
const SauceReporter = require('../../../src/sauce-reporter');

describe('SauceReporter', function () {
  describe('.prepareAsset', function () {
    it('should return an asset in a /tmp folder', function () {
      fs.existsSync.mockReturnValue(true);
      fs.copyFileSync.mockReturnValue(null);
      const asset = SauceReporter.prepareAsset('spec/file', '/results', '/tmp', 'fizz', 'buzz');
      expect(asset).toEqual('/tmp/buzz');
    });
    it('should return null if asset file not found', function () {
      fs.existsSync.mockReturnValue(false);
      const asset = SauceReporter.prepareAsset('spec/file', '/results', '/tmp', 'fizz', 'buzz');
      expect(asset).toEqual(null);
    });
  });
  describe('.prepareAssets', function () {
    it('should return a list of assets', async function () {
      fs.existsSync.mockReturnValue(true);
      fs.copyFileSync.mockReturnValue(true);
      fs.mkdtempSync.mockReturnValue('tmp/folder');
      utils.getRunnerConfig.mockReturnValue({reportsDir: '/fake/reports/dir/', rootDir: '/fake/root/dir/'});
      SauceReporter.mergeVideos = jest.fn().mockImplementation(async function () {});
      const res = await SauceReporter.prepareAssets(['spec/file.test.js'], 'results/');
      expect(res).toEqual([
        'tmp/folder/file.test.js.mp4',
        'tmp/folder/file.test.js.json',
        'tmp/folder/file.test.js.xml',
        'tmp/folder/console.log',
        'results/video.mp4'
      ]);
    });
    it('should return an empty list of assets if files not found (addresses DEVX-273)', async function () {
      fs.existsSync.mockReturnValue(false);
      fs.copyFileSync.mockReturnValue(true);
      fs.mkdtempSync.mockReturnValue('tmp/folder');
      utils.getRunnerConfig.mockReturnValue({reportsDir: '/fake/reports/dir/', rootDir: '/fake/root/dir/'});
      const res = await SauceReporter.prepareAssets('spec/file', 'results/');
      expect(res).toEqual([]);
    });
  });
  describe('.sauceReporter', function () {
    let prepareAssetsSpy, uploadJobAssetsSpy;
    beforeEach(function () {
      webdriverio.remote.mockImplementation(function () {});
      prepareAssetsSpy = jest.spyOn(SauceReporter, 'prepareAssets');
      // eslint-disable-next-line require-await
      uploadJobAssetsSpy = jest.fn().mockImplementation(async () => ({errors: ['some fake error']}));
      SauceLabs.default.mockImplementation(function () {
        // eslint-disable-next-line require-await
        this.listJobs = async () => ({
          jobs: [{id: 'a'}, {id: 'b'}]
        });
        this.uploadJobAssets = uploadJobAssetsSpy;
        this.updateJob = async () => {};
      });
    });
    it('should call uploadJobAssets on SauceLabs api', async function () {
      prepareAssetsSpy.mockReturnValue(['asset/one', 'asset/two']);
      await SauceReporter.sauceReporter('build', 'browser', [{
        spec: {name: 'MySpec'}, stats: {failures: 0}
      }], 0);
      expect(uploadJobAssetsSpy.mock.calls).toEqual([
        ['a', {'files': ['asset/one', 'asset/two']}]
      ]);
    });
    it('should output err when upload failed', async function () {
      let originalConsole = console.error;
      prepareAssetsSpy.mockReturnValue(['asset/one', 'asset/two']);
      await SauceReporter.sauceReporter('build', 'browser', {
        spec: {name: 'MySpec'}, stats: {failures: 0}
      });

      let consoleOutput = [];
      const mockErr = output => consoleOutput.push(output);
      console.error = mockErr;

      expect(uploadJobAssetsSpy.mock.calls).toEqual([
        ['a', {'files': ['asset/one', 'asset/two']}]
      ]);
      expect(consoleOutput).calledOnce;

      console.error = originalConsole;
    });
  });
});
