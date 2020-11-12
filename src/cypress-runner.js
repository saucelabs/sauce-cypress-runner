const { sauceReporter, prepareAssets } = require('./sauce-reporter');
const path = require('path');
const _ = require('lodash');
const fs = require('fs');
const { getCypressConfigObject } = require('./utils');
const cypress = require('cypress');
const yargs = require('yargs/yargs');

const report = async (results, cypressRunObj) => {
  // Prepare the assets
  const runs = results.runs || [];
  const resultsFolder = path.join(cypressRunObj.project, cypressRunObj.resultsFolder);
  let specFiles = runs.map((run) => run.spec.name);
  let assets = await prepareAssets(specFiles, resultsFolder);
  let failures;
  if (_.isNumber(results.failures)) {
    failures = results.failures;
  } else {
    failures = results.totalFailed;
  }
  if (!(process.env.SAUCE_USERNAME && process.env.SAUCE_ACCESS_KEY)) {
    console.log('Skipping asset uploads! Remember to setup your SAUCE_USERNAME/SAUCE_ACCESS_KEY');
    return failures === 0;
  }
  if (process.env.SAUCE_VM) {
    console.log('Skipping asset upload inside of sauce vm. Asset uploads will take place in post process batch job');
    return failures === 0;
  }
  const buildName = process.env.SAUCE_BUILD_NAME || `stt-cypress-build-${(new Date()).getTime()}`;
  await sauceReporter(buildName, cypressRunObj.browser, assets, failures);

  return failures === 0;
};

const cypressRunner = async function (pathToCypressRunJson, suite) {
  let cypressRunObj;
  try {
    const cypressRunJson = JSON.parse(fs.readFileSync(pathToCypressRunJson, 'utf-8'));
    cypressRunObj = getCypressConfigObject(cypressRunJson, suite);
  } catch (e) {
    throw new Error(`Could not parse JSON in '${pathToCypressRunJson}'. reason=${e.message}`);
  }

  // Run cypress
  const results = await cypress.run(cypressRunObj);

  // Report the results to SauceLabs
  return await report(results, cypressRunObj);
};

// For dev and test purposes, this allows us to run our Cypress Runner from command line
if (require.main === module) {
  const argv = yargs(process.argv.slice(2))
    .command('$0', 'the default command')
    .option('run-json', {
      alias: 'r',
      type: 'string',
      description: 'Path to sauce runner json',
      default: path.join(process.cwd(), '.sauce', 'runner.json'),
    })
    .option('suite', {
      alias: 's',
      type: 'string',
      description: ''
    })
    .argv;
  const { runJson, suite } = argv;

  cypressRunner(runJson, suite)
      // eslint-disable-next-line promise/prefer-await-to-then
      .then((passed) => process.exit(passed ? 0 : 1))
      // eslint-disable-next-line promise/prefer-await-to-callbacks
      .catch((err) => {
        console.log(err);
        process.exit(1);
      });
}

exports.cypressRunner = cypressRunner;
