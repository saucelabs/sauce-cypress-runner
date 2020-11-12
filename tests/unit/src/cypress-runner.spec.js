jest.mock('cypress');
jest.mock('../../../src/sauce-reporter');

const cypress = require('cypress');
const path = require('path');
const { cypressRunner } = require('../../../src/cypress-runner');
const { sauceReporter, prepareAssets } = require('../../../src/sauce-reporter');

describe('.cypressRunner', function () {
  let mockCypressRun, mockSauceReporter, originalEnv;
  beforeEach(function () {
    originalEnv = process.env;
    process.env.SAUCE_BUILD_NAME = 'fake-build';
    mockCypressRun = cypress.run.mockImplementation(() => ({
      failures: 0,
    }));
    prepareAssets.mockImplementation(() => (
      []
    ));
    mockSauceReporter = sauceReporter.mockImplementation(() => {});
  });
  afterEach(function () {
    process.env = originalEnv;
  });
  it('fixtures/kitchen-sink.json', async function () {
    const statusOne = await cypressRunner(path.join(__dirname, 'fixtures', 'kitchen-sink.json'), 'foo');
    const statusTwo = await cypressRunner(path.join(__dirname, 'fixtures', 'kitchen-sink.json'), 'bar');
    expect(statusOne).toEqual(true);
    expect(statusTwo).toEqual(true);
    expect(mockCypressRun.mock.calls).toMatchSnapshot();
    expect(mockSauceReporter.mock.calls).toMatchSnapshot();
  });
});