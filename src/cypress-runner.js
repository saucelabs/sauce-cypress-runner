const { sauceReporter }   = require('./sauce-reporter');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const yaml = require('js-yaml');
const cypress = require('cypress');
let glob = require('glob');
let { exec } = require('child_process');
const { getAbsolutePath } = require('./utils');

// Promisify the callback functions
const exists = promisify(fs.exists);
exec = promisify(exec);
glob = promisify(glob);

const DEFAULT_BROWSER = 'chrome';
const buildName = process.env.SAUCE_BUILD_NAME || `stt-cypress-build-${(new Date()).getTime()}`;
const supportedBrowsers = {
  'chrome': 'chrome',
  'firefox': 'firefox'
}
let browserName = process.env.BROWSER_NAME || DEFAULT_BROWSER;
browserName = supportedBrowsers[browserName.toLowerCase()];
if (!browserName) {
  console.error(`Unsupported browser: ${process.env.BROWSER_NAME}. Sorry.`);
  process.exit(1);
}

const report = async (results) => {
  const status = results.failures || results.totalFailed;
  if (!(process.env.SAUCE_USERNAME && process.env.SAUCE_ACCESS_KEY)) {
    console.log('Skipping asset uploads! Remember to setup your SAUCE_USERNAME/SAUCE_ACCESS_KEY');
    return status;
  }
  const runs = results.runs || [];
  for(let spec of runs) {
    await sauceReporter(buildName, browserName, spec);
  };
  return status;
}

const cypressRunner = async function () {
  try {
    // Get the configuration info from config.yaml
    const configYamlPath = process.env.CONFIG_FILE || 'config.yml';
    const config = yaml.safeLoad(await promisify(fs.readFile)(configYamlPath, 'utf8'));

    // If relative paths were provided in YAML, convert them to absolute
    const targetDir = getAbsolutePath(config.targetDir);
    const reportsDir = getAbsolutePath(config.reportsDir);

    // If a typescript config is found in the targetsDir, then compile with it
    const tsconfigPath = path.join(targetDir, 'tsconfig.json');

    const pathsToTypescriptFiles = await glob(path.join(targetDir, '**/*.ts'));
    const hasTypescriptFiles = pathsToTypescriptFiles.length > 0;

    if (await exists(tsconfigPath)) {
      console.log(`Compiling Typescript files from tsconfig '${tsconfigPath}'`);
      await exec(`npx tsc -p "${tsconfigPath}"`);
    } else if (hasTypescriptFiles) {
      console.log(`Compiling typescript files found in '${targetDir}'`)
      await exec(`npx tsc "${pathsToTypescriptFiles}"`);
    }


    // Get the cypress.json config file (https://docs.cypress.io/guides/references/configuration.html#Options)
    let configFile = 'cypress.json';
    let cypressJsonPath = path.join(targetDir, 'cypress.json');
    if (await exists(cypressJsonPath)) {
      configFile = path.relative(process.cwd(), cypressJsonPath);
    }

    // Get the cypress env variables from 'cypress.env.json' (if present)
    let env = {};
    const cypressEnvPath = path.join(targetDir, 'cypress.env.json')
    if (await exists(cypressEnvPath)) {
      try {
        env = JSON.parse(await promisify(fs.readFile)(cypressEnvPath));
      } catch (e) {
        console.error(`Could not parse contents of '${cypressEnvPath}'. Will use empty object for environment variables.`);
      }
    }

    const results = await cypress.run({
      browser: browserName,
      configFile,
      config: {
        env,
        video: true,
        videosFolder: reportsDir,
        videoCompression: false,
        videoUploadOnPasses: false,
        screenshotsFolder: reportsDir,
        integrationFolder: targetDir,
        testFiles: `${targetDir}/**/?(*.)+(spec|test).js?(x)`,
        reporter: "src/custom-reporter.js",
        reporterOptions: {
          mochaFile: `${reportsDir}/[suite].xml`
        }
      }
    });
    const status = await report(results);
    process.exit(status);
  }catch (err) {
    console.log(err);
    process.exit(1);
  }
}

// For dev and test purposes, this allows us to run our Cypress Runner from command line
if (require.main === module) {
  cypressRunner();
}

exports.cypressRunner = cypressRunner