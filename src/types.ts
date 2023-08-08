
import { Region } from '@saucelabs/testcomposer';
import { NpmConfigContainer, PathContainer } from 'sauce-testrunner-utils/lib/types';

export type MetaData = {
  tags: string[];
  build: string;
}

export type SauceConfig = {
  region: Region;
  metadata: object;
};

export type Suite = {
  browser: string;
};

export type CypressConfig = {
  project: string;
  browser: string;
  headed: boolean;
  headless: boolean;
  testingType: any;
  configFile: string;
  record?: boolean;
  key?: string;
  reporters?: any[];
  config: {
    videosFolder: string;
    screenshotsFolder: string;
    video: boolean;
    videoCompression: boolean;
    videoUploadOnPasses: boolean;
    env: {
      [key: string]: string
    }
  };
};

export type RunConfig = {
  sauce: SauceConfig;
  suites: any[];
  resultsDir: string;
  path: string;
  cypress: CypressConfig;
} & NpmConfigContainer & PathContainer & ResultPathContainer;

export type Results = {
  runs: any[];
  failures: number;
  totalFailed: number;
};

export type ResultPathContainer = {
  resultsDir: string;
};

// XML Types

export type XmlSuiteAttributes = {
  time?: number | string;
  failures?: number;
  skipped?: number;
  tests: number;
  errors?: number;
  file?: string;
  package?: string;
  name?: string;
  hostname?: string;
  id?: string;
};

export type XmlSuiteAttrContainer = {
  _attr: XmlSuiteAttributes;
};

type XmlTestCaseAttributes = {
  time: number | string;
  failures?: number;
  skipped?: number;
  classname?: string;
  name?: string;
};

export type XmlProperties = {
  properties: any;
};

export type XmlTestCase = {
  _attr?: XmlTestCaseAttributes;
  'system-out'?: any;
  'system-err'?: any;
  failure?: any;
};

export type XmlTestCaseContainer = {
  testcase: XmlTestCase[];
};

export type XmlSuite = {
  testsuite?: (XmlSuiteAttrContainer | XmlProperties | XmlTestCaseContainer)[];
} & XmlSuiteAttrContainer;

export type XmlSuiteContainer = {
  testsuites: XmlSuite;
};

// Type SauceReporter
export type Metrics = {
  name: string;
  data: any;
};
