const { sauceReporter, prepareAssets } = require('./sauce-reporter');
const path = require('path');
const fs = require('fs');
const child_process = require('child_process');
const { shouldRecordVideo, getAbsolutePath, loadRunConfig } = require('./utils');
const cypress = require('cypress');
const yargs = require('yargs/yargs');
const _ = require('lodash');

const report = async (results, browserName, runCfg, suiteName) => {
  // Prepare the assets
  const runs = results.runs || [];
  let specFiles = runs.map((run) => run.spec.name);
  let assets = await prepareAssets(
      specFiles,
      runCfg.resultsDir,
  );

  let failures = results.failures || results.totalFailed;
  if (!(process.env.SAUCE_USERNAME && process.env.SAUCE_ACCESS_KEY)) {
    console.log('Skipping asset uploads! Remember to setup your SAUCE_USERNAME/SAUCE_ACCESS_KEY');
    return failures === 0;
  }
  if (process.env.SAUCE_VM) {
    console.log('Skipping asset upload inside of sauce vm. Asset uploads will take place in post process batch job');
    return failures === 0;
  }

  await sauceReporter(runCfg, suiteName, browserName, assets, failures);

  return failures === 0;
};

const installDependencies = function (runCfg) {
  const npmConfig = runCfg.npm || { packages: {}};
  const packageList = Object.entries(npmConfig.packages).map(([pkg, version]) => `${pkg}@${version}`);

  if (packageList.length === 0) {
    return;
  }

  return new Promise((resolve, reject) => {
    const child = child_process.spawn(path.join(path.dirname(process.argv[0]), 'npm'), ['install', '--no-save', ...packageList]);
    child.stdout.pipe(process.stdout);
    child.stderr.pipe(process.stderr);
    child.on('exit', (exitCode) => {
      if (exitCode === 0) {
        resolve();
      } else {
        reject();
      }
    });
  });
};

const getCypressOpts = function (runCfg, suiteName) {
  // Get user settings from suites.
  const suites = runCfg.suites || [];
  const suite = suites.find((testSuite) => testSuite.name === suiteName);
  if (!suite) {
    throw new Error(`Could not find suite named '${suiteName}'; available suites='${suites}`);
  }

  let cypressCfgFile = path.basename(runCfg.cypress.configFile);
  if (!fs.existsSync(getAbsolutePath(cypressCfgFile))) {
    throw new Error(`Unable to locate the cypress config file. Looked for '${getAbsolutePath(cypressCfgFile)}'.`);
  }

  const cypressCfg = JSON.parse(fs.readFileSync(cypressCfgFile, 'utf8'));

  let opts = {
    project: path.dirname(runCfg.path),
    browser: process.env.SAUCE_BROWSER || suite.browser || 'chrome',
    configFile: cypressCfgFile,
    config: {
      testFiles: suite.config.testFiles,
      videosFolder: runCfg.resultsDir,
      screenshotsFolder: runCfg.resultsDir,
      video: shouldRecordVideo(),
      reporter: path.join(__dirname, 'custom-reporter.js'),
      reporterOptions: {
        mochaFile: `${runCfg.resultsDir}/[suite].xml`,
        specRoot: cypressCfg.integrationFolder || 'cypress/integration',
      },
      videoCompression: false,
      videoUploadOnPasses: false,
    }
  };

  _.defaultsDeep(opts.config, suite.config);

  return opts;
};

const cypressRunner = async function (runCfgPath, suiteName) {
  runCfgPath = getAbsolutePath(runCfgPath);
  const runCfg = await loadRunConfig(runCfgPath);
  runCfg.path = runCfgPath;
  runCfg.resultsDir = path.join(path.dirname(runCfgPath), '__assets__');

  await installDependencies(runCfg);
  let cypressOpts = getCypressOpts(runCfg, suiteName);
  const results = await cypress.run(cypressOpts);

  return await report(results, cypressOpts.browser, runCfg, suiteName);
};

// For dev and test purposes, this allows us to run our Cypress Runner from command line
if (require.main === module) {
  console.log(`Sauce Cypress Runner ${require(path.join(__dirname, '..', 'package.json')).version}`);

  const argv = yargs(process.argv.slice(2))
      .command('$0', 'the default command')
      .option('runCfgPath', {
        alias: 'r',
        type: 'string',
        description: 'Path to sauce runner json',
      })
      .option('suiteName', {
        alias: 's',
        type: 'string',
        description: 'Select the suite to run'
      })
      .demandOption(['runCfgPath', 'suiteName'])
      .argv;
  const { runCfgPath, suiteName } = argv;

  cypressRunner(runCfgPath, suiteName)
      // eslint-disable-next-line promise/prefer-await-to-then
      .then((passed) => process.exit(passed ? 0 : 1))
      // eslint-disable-next-line promise/prefer-await-to-callbacks
      .catch((err) => {
        console.log(err);
        process.exit(1);
      });
}

exports.cypressRunner = cypressRunner;
