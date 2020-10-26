jest.mock('fs');
jest.mock('webdriverio');
jest.mock('saucelabs');
const fs = require('fs');
const webdriverio = require('webdriverio');
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
      const res = await SauceReporter.prepareAssets('spec/file', 'results/');
      expect(res).toEqual([
        'tmp/folder/video.mp4',
        'tmp/folder/log.json',
        'tmp/folder/cypress.log',
        'tmp/folder/junit.xml'
      ]);
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
      await SauceReporter.sauceReporter('build', 'browser', {
        spec: {name: 'MySpec'}, stats: {failures: 0}
      });
      expect(uploadJobAssetsSpy.mock.calls).toEqual([
        ['a', {'files': ['asset/one', 'asset/two']}]
      ]);
    });
  });
});