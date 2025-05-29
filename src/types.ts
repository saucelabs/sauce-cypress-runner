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
  testingType: unknown;
  configFile: string;
  record?: boolean;
  key?: string;
  reporters?: unknown[];
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
  suites: unknown[];
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
