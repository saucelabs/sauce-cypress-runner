jest.mock('mkdirp');
jest.mock('fs');
const mkdirp = require('mkdirp');
const fs = require('fs');
const path = require('path');
const MochaJUnitReporter = require('../../../src/custom-reporter');

describe('Custom Reporter', function () {
  describe('.report', function () {
    it('calls flush on a spec file with full path', function () {
      const { report } = MochaJUnitReporter.prototype;
      const ctx = {};
      ctx._runner = {suite: { file: 'spec/folder/path/to/spec'}};
      ctx.flush = jest.fn(function () {});
      ctx._options = {};
      ctx._options.specFolder = path.join(process.cwd(), 'spec', 'folder');
      ctx._options.specRoot = path.join(process.cwd(), 'spec', 'folder');
      report.call(ctx, 'a', 'b');
      expect(ctx.flush.mock.calls).toEqual([['a', 'path/to/spec', 'b']]);
    });
    it('translates relative paths to absolute paths', function () {
      const { report } = MochaJUnitReporter.prototype;
      const ctx = {};
      ctx._runner = {suite: { file: 'spec/folder/path/to/spec'}};
      ctx.flush = jest.fn(function () {});
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
      mkdirp.mockImplementation(function () {});
      fs.writeFileSync.mockImplementation(function () {});
      writeXmlToDisk(xml, filepath, filename);
      expect(fs.writeFileSync.mock.calls).toEqual([
        ['/path/to/subdir-a/subdir-b/test.spec.js.xml', xml, 'utf-8'],
      ]);
    });
  });
});