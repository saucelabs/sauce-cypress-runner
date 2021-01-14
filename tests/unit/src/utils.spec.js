jest.mock('child_process');
const path = require('path');
const childProcess = require('child_process');
const { EventEmitter } = require('events');
const { getAbsolutePath, shouldRecordVideo, installDependencies, getArgs, getEnv, getSuite } = require('../../../src/utils');

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
      const calls = childProcess.spawn.mock.calls;
      calls[0][0] = calls[0][0].replace(path.join(__dirname, '..', '..', '..'), '/fake/home');
      calls[0][1][0] = calls[0][1][0].replace(path.join(__dirname, '..', '..', '..'), '/fake/home');
      expect(calls).toMatchSnapshot();
    });
    it('should call npm + install on non-Sauce VM', async function () {
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
  describe('.getArgs', function () {
    let backupArgv;
    beforeEach(function () {
      backupArgv = process.argv;
      process.argv = [
        '/path/to/node',
        '/path/to/sauce-cypress-runner',
        '--suiteName', 'kitchen-sink-1',
        '--runCfgPath', './tests/kitchen-sink-tests/sauce-runner.json'
      ];
    });
    afterEach(function () {
      process.argv = backupArgv;
    });
    it('should parse the args', function () {
      const commandLineArgs = getArgs();
      expect(commandLineArgs).toMatchSnapshot();
      expect(getArgs()).toBe(commandLineArgs);
    });
  });
  describe('.getSuite', function () {
    it('should get a suite from a list', function () {
      const runCfg = {
        suites: [
          {name: 'hello', arg: 'world'}
        ]
      };
      expect(getSuite(runCfg, 'hello').arg).toEqual('world');
      expect(getSuite(runCfg, 'non-existent')).toBeUndefined();
    });
  });
  describe('.getEnv', function () {
    let backupEnv;
    beforeEach(function () {
      backupEnv = process.env;
      process.env = {
        'HELLO': 'WORLD',
        'FOO': 'BAR',
      };
    });
    afterEach(function () {
      process.env = backupEnv;
    });
    it('should parse env variables from runConfig', function () {
      const suite = {
        env: {
          'A': '1',
          'B': '2',
          'HELLO': '$HELLO',
        },
        config: {
          env: {
            'C': '3',
          }
        }
      };
      const env = getEnv(suite);
      expect(env).toMatchSnapshot();
      expect(env.FOO).toBeUndefined();
    });
  });
});