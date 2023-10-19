import fs from 'fs';
import path from 'path';
import stream from 'stream';
import childProcess from 'child_process';

function cypressRecorder() {
  // console.log is saved out of reportsDir since it is cleared on startup.
  const fd = fs.openSync(path.join(process.cwd(), 'console.log'), 'w+', 0o644);
  const ws = new stream.Writable({
    write(data, encoding, cb) {
      fs.write(fd, data, undefined, encoding, cb);
    },
  });

  const [nodeBin] = process.argv;
  const child = childProcess.spawn(nodeBin, [
    path.join(__dirname, 'cypress-runner.js'),
    ...process.argv.slice(2),
  ]);

  child.stdout.pipe(process.stdout);
  child.stderr.pipe(process.stderr);
  child.stdout.pipe(ws);
  child.stderr.pipe(ws);

  child.on('exit', (exitCode) => {
    fs.closeSync(fd);
    process.exit(exitCode);
  });
}

exports.cypressRecorder = cypressRecorder;
