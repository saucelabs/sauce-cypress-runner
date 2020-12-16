jest.mock('child_process');
const childProcess = require('child_process');
const { EventEmitter } = require('events');
const { getAbsolutePath, shouldRecordVideo, installDependencies } = require('../../../src/utils');

describe('utils', function () {
  describe('.installDependencies', function () {
    let mockSpawnEventEmitter;
    let backupEnv;
    const runCfg = {
      npm: {
        packages: {
          'left-pad': '1.3.0',
          jquery: 2,
        }
      }
    };
    beforeEach(function () {
      backupEnv = {...process.env};
      childProcess.spawn.mockClear();
      childProcess.spawn.mockImplementation(() => {
        mockSpawnEventEmitter = new EventEmitter();
        mockSpawnEventEmitter.stdout = {pipe () {}};
        mockSpawnEventEmitter.stderr = {pipe () {}};
        return mockSpawnEventEmitter;
      });
    });
    afterEach(function () {
      process.env = backupEnv;
    });
    it('should call node + npm on Sauce VM', async function () {
      process.env.SAUCE_VM = 'truthy';
      const installDeps = installDependencies(runCfg);
      mockSpawnEventEmitter.emit('exit', 0);
      await installDeps;
      expect(childProcess.spawn.mock.calls).toMatchSnapshot();
    });
    it('should call npm plus install otherwise', async function () {
      const installDeps = installDependencies(runCfg);
      mockSpawnEventEmitter.emit('exit', 0);
      await installDeps;
      expect(childProcess.spawn.mock.calls).toMatchSnapshot();
    });
    it('should do nothing if no packages', async function () {
      const res = await installDependencies({});
      expect(res).toEqual(undefined);
    });
    it('should gracefully exit with exit code non-zero', function (done) {
      const installDeps = installDependencies(runCfg);
      mockSpawnEventEmitter.emit('exit', 1);
      installDeps.catch(function (e) {
        expect(e).toMatch(/Could not install NPM dependencies/);
        done();
      }).finally(function () {
        throw new Error('Should not reach this statement');
      });
    });
  });
  describe('.getAbsolutePath', function () {
    it('returns absolute path unmodified', function () {
      expect(getAbsolutePath('/absolute/path/to/asset/')).toEqual('/absolute/path/to/asset/');
    });
    it('translates relative path to absolute', function () {
      expect(getAbsolutePath('path/to/asset/')).toMatch(/\/path\/to\/asset\/$/);
    });
  });
  describe('.shouldRecordVideo', function () {
    let previousEnv;
    beforeEach(function () {
      previousEnv = process.env.SAUCE_CYPRESS_VIDEO_RECORDING;
    });
    afterEach(function () {
      process.env.SAUCE_CYPRESS_VIDEO_RECORDING = previousEnv;
    });
    it('returns true when SAUCE_CYPRESS_VIDEO_RECORDING is undefined', function () {
      expect(shouldRecordVideo()).toEqual(true);
    });
    it('returns false when SAUCE_CYPRESS_VIDEO_RECORDING is 0', function () {
      process.env.SAUCE_CYPRESS_VIDEO_RECORDING = 0;
      expect(shouldRecordVideo()).toEqual(false);
    });
    it('returns true when SAUCE_CYPRESS_VIDEO_RECORDING is 1', function () {
      process.env.SAUCE_CYPRESS_VIDEO_RECORDING = 1;
      expect(shouldRecordVideo()).toEqual(true);
    });
    it('returns true when SAUCE_CYPRESS_VIDEO_RECORDING is true', function () {
      process.env.SAUCE_CYPRESS_VIDEO_RECORDING = true;
      expect(shouldRecordVideo()).toEqual(true);
    });
    it('returns false when SAUCE_CYPRESS_VIDEO_RECORDING is false', function () {
      process.env.SAUCE_CYPRESS_VIDEO_RECORDING = false;
      expect(shouldRecordVideo()).toEqual(false);
    });
  });
});