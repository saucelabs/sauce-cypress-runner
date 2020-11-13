'use strict';
/**
 * This is an extension of MochaJunitReporter
 */

let xml = require('xml');
let Base = require('mocha').reporters.Base;
let fs = require('fs');
let path = require('path');
let debug = require('debug')('mocha-junit-reporter');
let mkdirp = require('mkdirp');
let md5 = require('md5');
let stripAnsi = require('strip-ansi');

let createStatsCollector;
let mocha6plus;

try {
  let json = JSON.parse(
    fs.readFileSync(path.dirname(require.resolve('mocha')) + '/package.json', 'utf8')
  );
  let version = json.version;
  if (version >= '6') {
    createStatsCollector = require('mocha/lib/stats-collector');
    mocha6plus = true;
  } else {
    mocha6plus = false;
  }
} catch (e) {
  // eslint-disable-next-line no-console
  console.warn("Couldn't determine Mocha version");
}
module.exports = MochaJUnitReporter;

// A subset of invalid characters as defined in http://www.w3.org/TR/xml/#charsets that can occur in e.g. stacktraces
// regex lifted from https://github.com/MylesBorins/xml-sanitizer/ (licensed MIT)
let INVALID_CHARACTERS_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007f-\u0084\u0086-\u009f\uD800-\uDFFF\uFDD0-\uFDFF\uFFFF\uC008]/g; //eslint-disable-line no-control-regex

function findReporterOptions (options) {
  debug('Checking for options in', options);
  if (!options) {
    debug('No options provided');
    return {};
  }
  if (!mocha6plus) {
    debug('Options for pre mocha@6');
    return options.reporterOptions || {};
  }
  if (options.reporterOptions) {
    debug('Command-line options for mocha@6+');
    return options.reporterOptions;
  }
  // this is require to handle .mocharc.js files
  debug('Looking for .mocharc.js options');
  return Object.keys(options).filter(function (key) { return key.indexOf('reporterOptions.') === 0; })
    .reduce(function (reporterOptions, key) {
      reporterOptions[key.substring('reporterOptions.'.length)] = options[key];
      return reporterOptions;
    }, {});
}

function configureDefaults (options) {
  let config = findReporterOptions(options);
  debug('options', config);
  config.mochaFile = getSetting(config.mochaFile, 'MOCHA_FILE', 'test-results.xml');
  config.attachments = getSetting(config.attachments, 'ATTACHMENTS', false);
  config.antMode = getSetting(config.antMode, 'ANT_MODE', false);
  config.jenkinsMode = getSetting(config.jenkinsMode, 'JENKINS_MODE', false);
  config.properties = getSetting(config.properties, 'PROPERTIES', null, parsePropertiesFromEnv);
  config.toConsole = !!config.toConsole;
  config.rootSuiteTitle = config.rootSuiteTitle || 'Root Suite';
  config.testsuitesTitle = config.testsuitesTitle || 'Mocha Tests';

  if (config.antMode) {
    updateOptionsForAntMode(config);
  }

  if (config.jenkinsMode) {
    updateOptionsForJenkinsMode(config);
  }

  config.suiteTitleSeparatedBy = config.suiteTitleSeparatedBy || ' ';

  return config;
}

function updateOptionsForAntMode (options) {
  options.antHostname = getSetting(options.antHostname, 'ANT_HOSTNAME', process.env.HOSTNAME);

  if (!options.properties) {
    options.properties = {};
  }
}

function updateOptionsForJenkinsMode (options) {
  if (options.useFullSuiteTitle === undefined) {
    options.useFullSuiteTitle = true;
  }
  debug('jenkins mode - testCaseSwitchClassnameAndName', options.testCaseSwitchClassnameAndName);
  if (options.testCaseSwitchClassnameAndName === undefined) {
    options.testCaseSwitchClassnameAndName = true;
  }
  if (options.suiteTitleSeparatedBy === undefined) {
    options.suiteTitleSeparatedBy = '.';
  }
}

/**
 * Determine an option value.
 * 1. If `key` is present in the environment, then use the environment value
 * 2. If `value` is specified, then use that value
 * 3. Fall back to `defaultVal`
 * @module mocha-junit-reporter
 * @param {Object} value - the value from the reporter options
 * @param {String} key - the environment variable to check
 * @param {Object} defaultVal - the fallback value
 * @param {function} transform - a transformation function to be used when loading values from the environment
 */
function getSetting (value, key, defaultVal, transform) {
  if (process.env[key] !== undefined) {
    let envVal = process.env[key];
    return (typeof transform === 'function') ? transform(envVal) : envVal;
  }
  if (value !== undefined) {
    return value;
  }
  return defaultVal;
}

function defaultSuiteTitle (suite) {
  if (suite.root && suite.title === '') {
    return stripAnsi(this._options.rootSuiteTitle);
  }
  return stripAnsi(suite.title);
}

function fullSuiteTitle (suite) {
  let parent = suite.parent;
  let title = [suite.title];

  while (parent) {
    if (parent.root && parent.title === '') {
      title.unshift(this._options.rootSuiteTitle);
    } else {
      title.unshift(parent.title);
    }
    parent = parent.parent;
  }

  return stripAnsi(title.join(this._options.suiteTitleSeparatedBy));
}

function isInvalidSuite (suite) {
  return (!suite.root && suite.title === '') || (suite.tests.length === 0 && suite.suites.length === 0);
}

function parsePropertiesFromEnv (envValue) {
  if (envValue) {
    debug('Parsing from env', envValue);
    return envValue.split(',').reduce(function (properties, prop) {
      let property = prop.split(':');
      properties[property[0]] = property[1];
      return properties;
    }, []);
  }

  return null;
}

function generateProperties (options) {
  let props = options.properties;
  if (!props) {
    return [];
  }
  return Object.keys(props).reduce(function (properties, name) {
    let value = props[name];
    properties.push({ property: { _attr: { name, value } } });
    return properties;
  }, []);
}

function getJenkinsClassname (test, options) {
  debug('Building jenkins classname for', test);
  let parent = test.parent;
  let titles = [];
  while (parent) {
    parent.title && titles.unshift(parent.title);
    parent = parent.parent;
  }
  return titles.join(options.suiteTitleSeparatedBy);
}

/**
 * JUnit reporter for mocha.js.
 * @module mocha-junit-reporter
 * @param {EventEmitter} runner - the test runner
 * @param {Object} options - mocha options
 */
function MochaJUnitReporter (runner, options) {
  if (mocha6plus) {
    createStatsCollector(runner);
  }
  this._options = configureDefaults(options);
  this._runner = runner;
  this._generateSuiteTitle = this._options.useFullSuiteTitle ? fullSuiteTitle : defaultSuiteTitle;
  this._antId = 0;
  let testsuites = [];
  this._testsuites = testsuites;
  let sauceJson = [];
  this._sauceJson = sauceJson;

  function lastSuite () {
    return testsuites[testsuites.length - 1].testsuite;
  }

  // get functionality from the Base reporter
  Base.call(this, runner);

  // remove old results
  this._runner.on('start', function (/*d*/) {
    if (fs.existsSync(this._options.mochaFile)) {
      debug('removing report file', this._options.mochaFile);
      fs.unlinkSync(this._options.mochaFile);
    }
  }.bind(this));

  this._runner.on('suite', function (suite) {
    if (!isInvalidSuite(suite)) {
      if (suite.tests.length > 0) {
        sauceJson.push(this.getSauceTestsuiteData(suite));
      }
      testsuites.push(this.getTestsuiteData(suite));
    }
  }.bind(this));

  this._runner.on('pass', function (test) {
    sauceJson.push(this.getSauceTestcaseData(test));
    lastSuite().push(this.getTestcaseData(test));
  }.bind(this));

  this._runner.on('fail', function (test, err) {
    sauceJson.push(this.getSauceTestcaseData(test));
    lastSuite().push(this.getTestcaseData(test, err));
  }.bind(this));

  if (this._options.includePending) {
    this._runner.on('pending', function (test) {
      let testcase = this.getTestcaseData(test);

      testcase.testcase.push({ skipped: null });
      lastSuite().push(testcase);
    }.bind(this));
  }

  let self = this;
  this._runner.on('end', function () {
    self.report(testsuites, sauceJson);
  });

}

MochaJUnitReporter.prototype.report = function (testsuites, sauceJson) {
  if (this._runner.suite.file) {
    const specFile = this._runner.suite.file;
    const specRoot = this._options.specRoot;
    this.flush(testsuites, path.relative(specRoot, specFile), sauceJson);
  }
};

MochaJUnitReporter.prototype.getSauceTestsuiteData = function (suite) {
  let _attr = {
    name: this._generateSuiteTitle(suite),
    timestamp: new Date().toISOString().slice(0, -5),
    tests: suite.tests.length
  };
  return {
    status: 'info',
    message: _attr.name,
    screenshot: null
  };
};

MochaJUnitReporter.prototype.getSauceTestcaseData = function (testcase) {
  // console.log(testcase);
  return {
    id: testcase.order,
    screenshot: 0,
    HTTPStatus: testcase.state === 'passed' ? 200 : 500,
    suggestion: null,
    statusCode: testcase.state === 'passed' ? 0 : 1,
    path: testcase.title,
    between_commands: testcase.duration,
    result: {
      status: testcase.state,
      failure_reason: JSON.stringify({
        'message': testcase.err && testcase.err.message,
        'stack': testcase.err && testcase.err.stack
      })
    },
    request: {
      body: testcase.body
    },
    in_video_timeline: 0
  };
};
/**
 * Produces an xml node for a test suite
 * @param  {Object} suite - a test suite
 * @return {Object}       - an object representing the xml node
 */
MochaJUnitReporter.prototype.getTestsuiteData = function (suite) {
  let antMode = this._options.antMode;

  let _attr = {
    name: this._generateSuiteTitle(suite),
    timestamp: new Date().toISOString().slice(0, -5),
    tests: suite.tests.length
  };
  let testSuite = { testsuite: [{ _attr }] };


  if (suite.file) {
    testSuite.testsuite[0]._attr.file = suite.file;
  }

  let properties = generateProperties(this._options);
  if (properties.length || antMode) {
    testSuite.testsuite.push({
      properties
    });
  }

  if (antMode) {
    _attr.package = _attr.name;
    _attr.hostname = this._options.antHostname;
    _attr.id = this._antId;
    _attr.errors = 0;
    this._antId += 1;
  }

  return testSuite;
};

/**
 * Produces an xml config for a given test case.
 * @param {object} test - test case
 * @param {object} err - if test failed, the failure object
 * @returns {object}
 */
MochaJUnitReporter.prototype.getTestcaseData = function (test, err) {
  let jenkinsMode = this._options.jenkinsMode;
  let flipClassAndName = this._options.testCaseSwitchClassnameAndName;
  let name = stripAnsi(jenkinsMode ? getJenkinsClassname(test, this._options) : test.fullTitle());
  let classname = stripAnsi(test.title);
  let testcase = {
    testcase: [{
      _attr: {
        name: flipClassAndName ? classname : name,
        time: (typeof test.duration === 'undefined') ? 0 : test.duration / 1000,
        classname: flipClassAndName ? name : classname
      }
    }]
  };

  // We need to merge console.logs and attachments into one <system-out> -
  //  see JUnit schema (only accepts 1 <system-out> per test).
  let systemOutLines = [];
  if (this._options.outputs && (test.consoleOutputs && test.consoleOutputs.length > 0)) {
    systemOutLines = systemOutLines.concat(test.consoleOutputs);
  }
  if (this._options.attachments && test.attachments && test.attachments.length > 0) {
    systemOutLines = systemOutLines.concat(test.attachments.map(
      function (file) {
        return '[[ATTACHMENT|' + file + ']]';
      }
    ));
  }
  if (systemOutLines.length > 0) {
    testcase.testcase.push({'system-out': this.removeInvalidCharacters(stripAnsi(systemOutLines.join('\n')))});
  }

  if (this._options.outputs && (test.consoleErrors && test.consoleErrors.length > 0)) {
    testcase.testcase.push({'system-err': this.removeInvalidCharacters(stripAnsi(test.consoleErrors.join('\n')))});
  }

  if (err) {
    let message;
    if (err.message && typeof err.message.toString === 'function') {
      message = err.message + '';
    } else if (typeof err.inspect === 'function') {
      message = err.inspect() + '';
    } else {
      message = '';
    }
    let failureMessage = err.stack || message;
    let failureElement = {
      _attr: {
        message: this.removeInvalidCharacters(message) || '',
        type: err.name || ''
      },
      _cdata: this.removeInvalidCharacters(failureMessage)
    };

    testcase.testcase.push({failure: failureElement});
  }
  return testcase;
};

/**
 * @param {string} input
 * @returns {string} without invalid characters
 */
MochaJUnitReporter.prototype.removeInvalidCharacters = function (input) {
  if (!input) {
    return input;
  }
  return input.replace(INVALID_CHARACTERS_REGEX, '');
};

/**
 * Writes xml to disk and ouputs content if "toConsole" is set to true.
 * @param {Array.<Object>} testsuites - a list of xml configs
 */
MochaJUnitReporter.prototype.flush = function (testsuites, specFile, sauceJson) {
  this._xml = this.getXml(testsuites);

  this.writeXmlToDisk(this._xml, this._options.mochaFile, specFile);

  if (this._options.toConsole === true) {
    console.log(this._xml); // eslint-disable-line no-console
  }

  this.writeSauceJsonToDisk(sauceJson, this._options.mochaFile, specFile);
};

/**
 * Produces an XML string from the given test data.
 * @param {Array.<Object>} testsuites - a list of xml configs
 * @returns {string}
 */
MochaJUnitReporter.prototype.getXml = function (testsuites) {
  let totalSuitesTime = 0;
  let totalTests = 0;
  let stats = this._runner.stats;
  let antMode = this._options.antMode;
  let hasProperties = (!!this._options.properties) || antMode;

  testsuites.forEach(function (suite) {
    let _suiteAttr = suite.testsuite[0]._attr;
    // testsuite is an array: [attrs, properties?, testcase, testcase, …]
    // we want to make sure that we are grabbing test cases at the correct index
    let _casesIndex = hasProperties ? 2 : 1;
    let _cases = suite.testsuite.slice(_casesIndex);
    let missingProps;

    _suiteAttr.time = 0;
    _suiteAttr.failures = 0;
    _suiteAttr.skipped = 0;

    let suiteTime = 0;
    _cases.forEach(function (testcase) {
      let lastNode = testcase.testcase[testcase.testcase.length - 1];

      _suiteAttr.skipped += Number('skipped' in lastNode);
      _suiteAttr.failures += Number('failure' in lastNode);
      suiteTime += testcase.testcase[0]._attr.time;
      testcase.testcase[0]._attr.time = testcase.testcase[0]._attr.time.toFixed(4);
    });
    _suiteAttr.time = suiteTime.toFixed(4);

    if (antMode) {
      missingProps = ['system-out', 'system-err'];
      suite.testsuite.forEach(function (item) {
        missingProps = missingProps.filter(function (prop) {
          return !item[prop];
        });
      });
      missingProps.forEach(function (prop) {
        let obj = {};
        obj[prop] = [];
        suite.testsuite.push(obj);
      });
    }

    if (!_suiteAttr.skipped) {
      delete _suiteAttr.skipped;
    }

    totalSuitesTime += suiteTime;
    totalTests += _suiteAttr.tests;
  });


  if (!antMode) {
    let rootSuite = {
      _attr: {
        name: this._options.testsuitesTitle,
        time: totalSuitesTime.toFixed(4),
        tests: totalTests,
        failures: stats.failures
      }
    };
    if (stats.pending) {
      rootSuite._attr.skipped = stats.pending;
    }
    testsuites = [rootSuite].concat(testsuites);
  }

  return xml({ testsuites }, { declaration: true, indent: '  ' });
};

/**
 * Writes a Sauce JSON test report json document.
 * @param {string} sauceJson - json object
 * @param {string} filePath - path to output file
 */
MochaJUnitReporter.prototype.writeSauceJsonToDisk = function (sauceJson, filePath, fileName) {
  if (filePath) {
    filePath = filePath.replace(/\.xml/, '.json');
    if (filePath.includes('[suite]')) {
      filePath = filePath.replace('[suite]', fileName);
    }
    debug('writing file to', filePath);
    mkdirp.sync(path.dirname(filePath));
    try {
      fs.writeFileSync(filePath, JSON.stringify(sauceJson, ' ', 2), 'utf-8');
    } catch (exc) {
      console.error(exc);
      debug('problem writing results: ' + exc);
    }
    debug('results written successfully');
  }
  return filePath;
};

/**
 * Writes a JUnit test report XML document.
 * @param {string} xml - xml string
 * @param {string} filePath - path to output file
 */
MochaJUnitReporter.prototype.writeXmlToDisk = function (xml, filePath, fileName) {
  let xmlOutFilePath;
  if (filePath) {
    if (filePath.includes('[hash]')) {
      xmlOutFilePath = filePath.replace('[hash]', md5(xml));
    } else if (filePath.includes('[suite]')) {
      xmlOutFilePath = filePath.replace('[suite]', fileName);
    }

    debug('writing file to', xmlOutFilePath);
    mkdirp.sync(path.dirname(xmlOutFilePath));

    try {
      fs.writeFileSync(xmlOutFilePath, xml, 'utf-8');
    } catch (exc) {
      debug('problem writing results: ' + exc);
    }
    debug('results written successfully');
    return xmlOutFilePath;
  }
  return filePath;
};