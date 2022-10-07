jest.mock('fs');
jest.mock('@saucelabs/testcomposer');
const fs = require('fs');
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
  const start = new Date().toISOString();
  const end = new Date().toISOString();

  describe('.prepareAssets', function () {
    beforeEach(function () {
      fs.existsSync.mockClear();
      fs.copyFileSync.mockClear();
    });
    it('should return a list of assets', async function () {
      fs.existsSync.mockReturnValue(true);
      fs.copyFileSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue(['fake/path/to/screenshot-1.png', 'fake/path/to/screenshot-2.png']);
      SauceReporter.mergeVideos = jest.fn().mockImplementation(async function () {});
      SauceReporter.mergeJunitFile = jest.fn().mockImplementation(function () {});
      const res = await SauceReporter.prepareAssets(['spec/file.test.js'], 'results/', [], 'fake-test-name', 'fake-browser-name');
      expect(fs.readdirSync.mock.calls).toMatchSnapshot();
      expect(res).toMatchSnapshot();
    });
    it('should return an empty list of assets if files not found (addresses DEVX-273)', async function () {
      fs.existsSync.mockReturnValue(false);
      fs.copyFileSync.mockReturnValue(true);
      fs.mkdtempSync.mockReturnValue('tmp/folder');
      SauceReporter.mergeJunitFile = jest.fn().mockImplementation(function () {});
      const res = await SauceReporter.prepareAssets('spec/file', 'results/', [], 'fake-test-name', 'fake-browser-name');
      expect(res).toEqual([]);
    });
  });
  describe('.sauceReporter', function () {
    let prepareAssetsSpy, uploadJobAssetsSpy, createJobSpy, createResultSpy, createJobWorkaroundSpy, backupEnv = process.env;
    beforeEach(function () {
      createJobWorkaroundSpy = jest.spyOn(SauceReporter, 'createJobWorkaround');
      // eslint-disable-next-line require-await
      createJobWorkaroundSpy.mockImplementation(async () => 'fake-session-id');
      prepareAssetsSpy = jest.spyOn(SauceReporter, 'prepareAssets');
      createJobWorkaroundSpy = jest.spyOn(SauceReporter, 'createJobWorkaround');
      createJobWorkaroundSpy.mockImplementation(async () => await 'fake-session-id');
      // eslint-disable-next-line require-await
      uploadJobAssetsSpy = jest.fn().mockImplementation(async () => ({errors: ['some fake error']}));
      createJobSpy = jest.fn().mockImplementation(async () => (await {sessionId: '123'}));
      createResultSpy = jest.fn().mockImplementation(async () => (await {sessionId: '123'}));
      SauceLabs.default.mockImplementation(function () {
        // eslint-disable-next-line require-await
        this.listJobs = async () => ({
          jobs: [{ id: 'a' }, { id: 'b' }]
        });
        this.uploadJobAssets = uploadJobAssetsSpy;
        this.updateJob = async () => { };
        this.createResultJob = createJobSpy;
        this.createJob = createResultSpy;
      });
      process.env.SAUCE_USERNAME = 'fake-user';
    });
    afterEach(function () {
      process.env = backupEnv;
    });

    it('should call uploadJobAssets on SauceLabs api', async function () {
      // eslint-disable-next-line require-await
      prepareAssetsSpy.mockImplementation(async () => ['asset/one', 'asset/two']);
      await SauceReporter.sauceReporter(fakeRunConfig, 'build', 'browser', ['asset/one', 'asset/two'], 0, start, end);
      expect(uploadJobAssetsSpy.mock.calls).toEqual([
        ['fake-session-id', {'files': ['asset/one', 'asset/two']}]
      ]);
    });
    it('should output err when upload failed', async function () {
      let consoleErrorSpy = jest.spyOn(global.console, 'error');
      prepareAssetsSpy.mockReturnValue(['asset/one', 'asset/two']);
      //createResultSpy.mockReturnValue({sessionId: 'a'});
      expect(await SauceReporter.sauceReporter(fakeRunConfig, 'build', 'browser', ['asset/one', 'asset/two'], 0, start, end)).toBeUndefined();
      expect(uploadJobAssetsSpy.mock.calls).toEqual([
        ['fake-session-id', {'files': ['asset/one', 'asset/two']}]
      ]);
      expect(consoleErrorSpy.mock.calls).toMatchSnapshot();
    });
    it('should not push assets when no sessionId from SauceLabs API', async function () {
      //createResultSpy.mockReturnValue({});
      SauceLabs.default.mockImplementation(function () {
        // eslint-disable-next-line require-await
        this.listJobs = async () => ({
          jobs: []
        });
        this.uploadJobAssets = uploadJobAssetsSpy;
        this.updateJob = async () => {};
        this.createJob = createResultSpy;
      });

      prepareAssetsSpy.mockReturnValue(['asset/one', 'asset/two']);
      expect(await SauceReporter.sauceReporter(fakeRunConfig, 'build', 'browser', ['asset/one', 'asset/two'], 0, start, end)).toBeUndefined();
    });
  });
});
