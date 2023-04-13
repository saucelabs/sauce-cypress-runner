jest.mock('mkdirp');
jest.mock('fs');
jest.mock('sauce-testrunner-utils');
import { mkdirpSync } from 'mkdirp';
import fs from 'fs';
import path from 'path';
import { MochaJUnitReporter } from '../../../src/custom-reporter';

type Context = {
  _runner: any;
  flush: jest.Mock;
  _options: any;
};

describe('Custom Reporter', function () {
  describe('.report', function () {
    it('calls flush on a spec file with full path', function () {
      const { report } = MochaJUnitReporter.prototype;
      const ctx = {} as Context;
      ctx._runner = {suite: { file: 'spec/folder/path/to/spec'}};
      ctx.flush = jest.fn();
      ctx._options = {};
      ctx._options.specFolder = path.join(process.cwd(), 'spec', 'folder');
      ctx._options.specRoot = path.join(process.cwd(), 'spec', 'folder');
      report.call(ctx, 'a', 'b');
      expect(ctx.flush.mock.calls).toEqual([['a', 'path/to/spec', 'b']]);
    });
    it('translates relative paths to absolute paths', function () {
      const { report } = MochaJUnitReporter.prototype;
      const ctx = {} as Context;
      ctx._runner = {suite: { file: 'spec/folder/path/to/spec'}};
      ctx.flush = jest.fn();
      ctx._options = {};
      ctx._options.specFolder = path.join('spec', 'folder');
      ctx._options.specRoot = path.join('spec', 'folder');
      report.call(ctx, 'a', 'b');
      expect(ctx.flush.mock.calls).toEqual([['a', 'path/to/spec', 'b']]);
    });
  });
  describe('.writeXmlToDisk', function () {
    it('maintains relative paths correctly (addresses DEVX-273)', function () {
      const { writeXmlToDisk } = MochaJUnitReporter.prototype;
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
            <items>
                <item>One</item>
                <item>Two</item>
                <item>Three</item>
            </items>
        `.trim();
      const filepath = '/path/to/[suite].xml';
      const filename = 'subdir-a/subdir-b/test.spec.js';
      mkdirpSync.mockImplementation();
      fs.writeFileSync.mockImplementation();
      writeXmlToDisk(xml, filepath, filename);
      expect(fs.writeFileSync.mock.calls).toEqual([
        ['/path/to/test.spec.js.xml', xml, 'utf-8'],
      ]);
    });
  });
});
