jest.mock('../../../src/npm');
const _ = require('lodash');
const npm = require('../../../src/npm');
const { getAbsolutePath, shouldRecordVideo, getArgs, getEnv, getSuite, prepareNpmEnv, setUpNpmConfig, installNpmDependencies } = require('../../../src/utils');

describe('utils', function () {
  describe('.prepareNpmEnv', function () {
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
    });
    afterEach(function () {
      process.env = backupEnv;
    });
    it('should set right registry for npm', async function () {
      await setUpNpmConfig('my.registry');
      expect(npm.load.mock.calls).toMatchSnapshot();
    });
    it('should call npm install', async function () {
      await installNpmDependencies(['mypackage@1.2.3']);
      expect(npm.install.mock.calls).toMatchSnapshot();
    });
    it('should use env var for registry', async function () {
      process.env.SAUCE_NPM_CACHE = 'npmland.io';
      await prepareNpmEnv(runCfg);
      expect(npm.load.mock.calls).toMatchSnapshot();
    });
    it('should use user registry', async function () {
      let cfg = _.clone(runCfg);
      cfg.npm.registry = 'registryland.io';
      await prepareNpmEnv(cfg);
      expect(npm.load.mock.calls).toMatchSnapshot();
    });
    it('should use default registry', async function () {
      await prepareNpmEnv(runCfg);
      expect(npm.load.mock.calls).toMatchSnapshot();
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
