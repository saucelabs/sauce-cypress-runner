const { getAbsolutePath, getRunnerConfig } = require('../../../src/utils');

describe('utils', function () {
  describe('.getAbsolutePath', function () {
    it('returns absolute path unmodified', function () {
      expect(getAbsolutePath('/absolute/path/to/asset/')).toEqual('/absolute/path/to/asset/');
    });
    it('translates relative path to absolute', function () {
      expect(getAbsolutePath('path/to/asset/')).toMatch(/\/path\/to\/asset\/$/);
    });
  });
  describe('.getRunnerConfig', function () {
    it('uses default config file', async function () {
      expect(await getRunnerConfig()).toEqual({
        reportsDir: '/home/seluser/cypress/results',
        rootDir: '/home/seluser/',
        targetDir: '/home/seluser/cypress/integration',
      });
    });
  });
});