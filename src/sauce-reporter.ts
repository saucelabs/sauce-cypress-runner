import path from 'path';
import fs from 'fs';
import { escapeXML } from 'sauce-testrunner-utils';
import convert from 'xml-js';
import { XmlSuiteContainer } from './types';

export function mergeJUnitFile(
  specFiles: any[],
  resultsFolder: string,
  testName: string,
  browserName: string,
  platformName: string,
) {
  if (specFiles.length === 0) {
    return;
  }

  const opts: {
    compact: boolean;
    spaces: number;
    textFn?: (v: string) => string;
  } = { compact: true, spaces: 4 };
  const testsuites = [];
  for (let i = 0; i < specFiles.length; i++) {
    const specJUnitFile = path.join(resultsFolder, `${specFiles[i]}.xml`);
    if (!fs.existsSync(specJUnitFile)) {
      console.warn(
        `JUnit file not found for spec: ${specFiles[i]}. Proceeding without it...`,
      );
      continue;
    }
    const xmlData = fs.readFileSync(specJUnitFile, 'utf8');
    const jsObj = convert.xml2js(xmlData, opts) as XmlSuiteContainer;
    if (jsObj.testsuites && jsObj.testsuites.testsuite) {
      testsuites.push(...jsObj.testsuites.testsuite);
    }
  }
  if (testsuites.length === 0) {
    return;
  }

  let totalTests = 0;
  let totalErr = 0;
  let totalFailure = 0;
  let totalDisabled = 0;
  let totalTime = 0.0;
  for (const ts of testsuites) {
    if (ts._attributes) {
      totalTests += +ts._attributes.tests || 0;
      totalFailure += +ts._attributes.failures || 0;
      totalTime += +ts._attributes.time || 0.0;
      totalErr += +ts._attributes.error || 0;
      totalDisabled += +ts._attributes.disabled || 0;
    }
  }

  const result = {
    testsuites: {
      testsuite: testsuites.filter(
        (item) => item._attributes?.name !== 'Root Suite',
      ),
      _attributes: {
        name: testName,
        tests: totalTests,
        failures: totalFailure,
        time: totalTime,
        error: totalErr,
        disabled: totalDisabled,
      },
    },
  };

  for (let i = 0; i < result.testsuites.testsuite.length; i++) {
    const testcase = result.testsuites.testsuite[i].testcase;

    // _attributes
    result.testsuites.testsuite[i]._attributes =
      result.testsuites.testsuite[i]._attributes || {};
    result.testsuites.testsuite[i]._attributes.id = i;

    // failure message
    if (testcase && testcase.failure) {
      result.testsuites.testsuite[i].testcase.failure._attributes = {
        message: escapeXML(testcase.failure._attributes.message || ''),
        type: testcase.failure._attributes.type || '',
      };
      result.testsuites.testsuite[i].testcase.failure._cdata =
        testcase.failure._cdata || '';
    }

    // properties
    result.testsuites.testsuite[i].properties = {
      property: [
        {
          _attributes: {
            name: 'platformName',
            value: getPlatformName(platformName),
          },
        },
        {
          _attributes: {
            name: 'browserName',
            value: getBrowsername(browserName),
          },
        },
      ],
    };
  }

  opts.textFn = escapeXML;
  const xmlResult = convert.js2xml(result, opts);
  fs.writeFileSync(path.join(resultsFolder, 'junit.xml'), xmlResult);
}

function getPlatformName(platformName: string) {
  if (process.platform.toLowerCase() === 'linux') {
    platformName = 'Linux';
  }

  return platformName;
}

function getBrowsername(browserName: string) {
  const browsers = browserName.split(':');
  if (browsers.length > 0) {
    browserName = browsers[browsers.length - 1];
  }

  return browserName;
}
