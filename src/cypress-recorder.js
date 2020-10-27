
const fs = require('fs');
const path = require('path');
const stream = require('stream');
const child_process = require('child_process');

const cypressRecorder = () => {
  const fd = fs.openSync(path.join(__dirname, '..', 'cypress', 'console.log'), 'w+', 0o644);
  const ws = stream.Writable({
    write (data, encoding, cb) { fs.write(fd, data, undefined, encoding, cb); },
  });

  const [nodeBin] = process.argv;
  console.log(nodeBin);
  const child = child_process.spawn(nodeBin, [path.join(__dirname, 'src', 'cypress-runner.js')]);

  child.stdout.pipe(process.stdout);
  child.stderr.pipe(process.stderr);
  child.stdout.pipe(ws);
  child.stderr.pipe(ws);

  child.on('exit', (exitCode) => ws.end(() => {
    fs.closeSync(fd);
    process.exit(exitCode);
  }));
};

exports.cypressRecorder = cypressRecorder;
