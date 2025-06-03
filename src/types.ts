import {
  NpmConfigContainer,
  PathContainer,
} from 'sauce-testrunner-utils/lib/types';

export type SauceConfig = {
  region: 'us-west-1' | 'us-east-4' | 'eu-central-1' | 'staging';
  metadata: object;
};

export type Suite = { browser: string };

export type CypressConfig = {
  project: string;
  browser: string;
  headed: boolean;
  headless: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  testingType: any;
  configFile: string;
  record?: boolean;
  key?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reporters?: any[];
  config: {
    videosFolder: string;
    screenshotsFolder: string;
    video: boolean;
    videoCompression: boolean;
    env: { [key: string]: string };
  };
};

export type RunConfig = {
  sauce: SauceConfig;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  suites: any[];
  resultsDir: string;
  path: string;
  cypress: CypressConfig;
  nodeVersion?: string;
} & NpmConfigContainer &
  PathContainer &
  ResultPathContainer &
  ArtifactsContainer;

export type ResultPathContainer = { resultsDir: string };

export type ArtifactsContainer = {
  artifacts?: { retain?: { [key: string]: string } };
};
