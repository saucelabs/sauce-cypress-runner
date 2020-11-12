jest.mock('fs');
jest.mock('saucelabs');
jest.mock('../../../src/utils');
jest.mock('axios');
const axios = require('axios');
const fs = require('fs');
const SauceLabs = require('saucelabs');
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
      SauceReporter.mergeVideos = jest.fn().mockImplementation(async function () {});
      const res = await SauceReporter.prepareAssets(['spec/file.test.js'], 'results/');
      expect(res).toMatchSnapshot();
    });
    it('should return an empty list of assets if files not found (addresses DEVX-273)', async function () {
      fs.existsSync.mockReturnValue(false);
      fs.copyFileSync.mockReturnValue(true);
      fs.mkdtempSync.mockReturnValue('tmp/folder');
      const res = await SauceReporter.prepareAssets('spec/file', 'results/');
      expect(res).toEqual([]);
    });
  });
  describe('.sauceReporter', function () {
    let prepareAssetsSpy, uploadJobAssetsSpy;
    beforeEach(function () {
      prepareAssetsSpy = jest.spyOn(SauceReporter, 'prepareAssets');
      // eslint-disable-next-line require-await
      uploadJobAssetsSpy = jest.fn().mockImplementation(async () => ({errors: ['some fake error']}));
      axios.post.mockImplementation(() => {});
      axios.get.mockImplementation(() => ({
        data: {jobs: [{id: 'fake-job'}]}
      }));
      SauceLabs.default.mockImplementation(function () {
        // eslint-disable-next-line require-await
        this.uploadJobAssets = uploadJobAssetsSpy;
        this.updateJob = async () => {};
      });
    });
    it('should call uploadJobAssets on SauceLabs api', async function () {
      prepareAssetsSpy.mockReturnValue(['asset/one', 'asset/two']);
      await SauceReporter.sauceReporter('build', 'browser', ['asset/one', 'asset/two'], 0);
      expect(uploadJobAssetsSpy.mock.calls).toEqual([
        ['fake-job', {'files': ['asset/one', 'asset/two']}]
      ]);
    });
    it('should output err when upload failed', async function () {
      let consoleErrorSpy = jest.spyOn(global.console, 'error');
      prepareAssetsSpy.mockReturnValue(['asset/one', 'asset/two']);
      expect(await SauceReporter.sauceReporter('build', 'browser', ['asset/one', 'asset/two'], 0)).toBeUndefined();
      expect(uploadJobAssetsSpy.mock.calls).toEqual([
        ['fake-job', {'files': ['asset/one', 'asset/two']}]
      ]);
      expect(consoleErrorSpy.mock.calls).toEqual([['some fake error']]);
    });
    it('should not push assets when no sessionId from SauceLabs API', async function () {
      SauceLabs.default.mockImplementation(function () {
        this.uploadJobAssets = uploadJobAssetsSpy;
        this.updateJob = async () => {};
      });
      axios.get.mockImplementation(() => ({
        data: {jobs: []}
      }));
      prepareAssetsSpy.mockReturnValue(['asset/one', 'asset/two']);
      expect(await SauceReporter.sauceReporter('build', 'browser', ['asset/one', 'asset/two'], 0)).toEqual('unable to retrieve test');
    });
  });
});
