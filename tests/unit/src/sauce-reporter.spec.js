jest.mock('fs');
jest.mock('webdriverio');
jest.mock('saucelabs');
const fs = require('fs');
const webdriverio = require('webdriverio');
const SauceLabs = require('saucelabs');
const SauceReporter = require('../../../src/sauce-reporter');

describe('SauceReporter', function () {
  const fakeRunConfig = {
    sauce: {
      metadata: {
        name: 'Fake Name',
      }
    }
  };
  describe('.prepareAssets', function () {
    it('should return a list of assets', async function () {
      fs.existsSync.mockReturnValue(true);
      fs.copyFileSync.mockReturnValue(true);
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
    let prepareAssetsSpy, uploadJobAssetsSpy, createJobSpy;
    beforeEach(function () {
      webdriverio.remote.mockImplementation(function () {});
      prepareAssetsSpy = jest.spyOn(SauceReporter, 'prepareAssets');
      // eslint-disable-next-line require-await
      uploadJobAssetsSpy = jest.fn().mockImplementation(async () => ({errors: ['some fake error']}));
      createJobSpy = jest.fn().mockImplementation(async () => ({sessionId: '123'}));
      SauceLabs.default.mockImplementation(function () {
        // eslint-disable-next-line require-await
        this.listJobs = async () => ({
          jobs: [{ id: 'a' }, { id: 'b' }]
        });
        this.uploadJobAssets = uploadJobAssetsSpy;
        this.updateJob = async () => { };
        this.createResultJob = createJobSpy;
      });
    });
    it('should call uploadJobAssets on SauceLabs api', async function () {
      prepareAssetsSpy.mockReturnValue(['asset/one', 'asset/two']);
      await SauceReporter.sauceReporter(fakeRunConfig, 'build', 'browser', ['asset/one', 'asset/two'], 0);
      expect(uploadJobAssetsSpy.mock.calls).toEqual([
        ['a', {'files': ['asset/one', 'asset/two']}]
      ]);
    });
    it('should output err when upload failed', async function () {
      let consoleErrorSpy = jest.spyOn(global.console, 'error');
      prepareAssetsSpy.mockReturnValue(['asset/one', 'asset/two']);
      expect(await SauceReporter.sauceReporter(fakeRunConfig, 'build', 'browser', ['asset/one', 'asset/two'], 0)).toBeUndefined();
      expect(uploadJobAssetsSpy.mock.calls).toEqual([
        ['a', {'files': ['asset/one', 'asset/two']}]
      ]);
      expect(consoleErrorSpy.mock.calls).not.empty;
    });
    it('should not push assets when no sessionId from SauceLabs API', async function () {
      SauceLabs.default.mockImplementation(function () {
        // eslint-disable-next-line require-await
        this.listJobs = async () => ({
          jobs: []
        });
        this.uploadJobAssets = uploadJobAssetsSpy;
        this.updateJob = async () => {};
      });

      prepareAssetsSpy.mockReturnValue(['asset/one', 'asset/two']);
      expect(await SauceReporter.sauceReporter(fakeRunConfig, 'build', 'browser', ['asset/one', 'asset/two'], 0)).toBeDefined();
    });
    it ('should create job via global data store', async function () {
      process.env.ENABLE_DATA_STORE = 'true';
      prepareAssetsSpy.mockReturnValue(['asset/one', 'asset/two']);
      await SauceReporter.sauceReporter(fakeRunConfig, 'build', 'browser', ['asset/one', 'asset/two'], 0);
      expect(createJobSpy).toBeCalled();
      expect(createJobSpy.mock.calls).toMatchSnapshot();
    });
    it ('should fail when global data store throws error', async function () {
      process.env.ENABLE_DATA_STORE = 'true';
      prepareAssetsSpy.mockReturnValue(['asset/one', 'asset/two']);
      await SauceReporter.sauceReporter(fakeRunConfig, 'build', 'browser', ['asset/one', 'asset/two'], 0);
      expect(createJobSpy).toBeCalled();
    });
  });
});
