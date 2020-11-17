const { getAbsolutePath, shouldRecordVideo } = require('../../../src/utils');

describe('utils', function () {
  describe('.getAbsolutePath', function () {
    it('returns absolute path unmodified', function () {
      expect(getAbsolutePath('/absolute/path/to/asset/')).toEqual('/absolute/path/to/asset/');
    });
    it('translates relative path to absolute', function () {
      expect(getAbsolutePath('path/to/asset/')).toMatch(/\/path\/to\/asset\/$/);
    });
  });
});

describe('.shouldRecordVideo', function () {
  let previousEnv;
  beforeEach(function () {
    previousEnv = process.env.SAUCE_CYPRESS_VIDEO_RECORDING;
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

  afterEach(function () {
    process.env.SAUCE_CYPRESS_VIDEO_RECORDING = previousEnv;
  });
});