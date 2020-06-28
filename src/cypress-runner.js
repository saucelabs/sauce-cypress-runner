const { spawn } = require('child_process');
const { sauceReporter }   = require('./sauce-reporter');
const fs = require('fs');

runCypress = () => {
  return new Promise((resolve, reject) => {
    const cyBin = "node_modules/.bin/cypress";
    try {
      const cyProc = spawn(cyBin, ["run"]);
      cyProc.stdout.on('data', (data) => {
        console.log(`${data}`);
      });
      cyProc.stderr.on('data', (data) => {
        console.error(`${data}`);
      });
      cyProc.on('close', (code) => {
        resolve(code);
      });
    } catch(e) {
      console.error(e);
      reject(e);
    }
  });
}

(async() => {
  try {
    let results = await runCypress();
    if (process.env.SAUCE_USERNAME && process.env.SAUCE_ACCESS_KEY) {
      fs.renameSync(
        '/home/seluser/cypress/videos/tests/actions.spec.js.mp4',
        '/home/seluser/cypress/videos/tests/video.mp4'
      )
      await sauceReporter('chrome', [
        '/home/seluser/cypress/videos/tests/video.mp4'
      ], results);
    } else {
      console.log('Skipping asset uploads! Remeber to setup your SAUCE_USERNAME/SAUCE_ACCESS_KEY')
    }
    process.exit(results);
  } catch(e) {
    console.log(e);
  }
})();