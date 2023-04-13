
import { Region } from '@saucelabs/testcomposer';

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

// FIXME: Check if type exists
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
};

export type Results = {
  runs: any[];
  failures: number;
  totalFailed: number;
};