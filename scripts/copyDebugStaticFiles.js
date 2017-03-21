import path from 'path';
import {exec} from 'child_process';

const filesToCopy = [
  'manifest.json',
  'pushwoosh-web-notifications.js',
  'pushwoosh-web-notifications.js.map',
  'pushwoosh-service-worker.js',
  'pushwoosh-service-worker.js.map'
];

const copyCmd = filesToCopy.map(f => {
  const sourceDir = '../dist';
  const targetDir = '../debug';
  return `cp -f ${
            path.join(__dirname, `${sourceDir}/${f}`)
          } ${
            path.join(__dirname, `${targetDir}/${f}`)
          }`;
}).join(' && ');

exec(copyCmd, (error, stdout, stderr) => {
  if (error) {
    console.error(`exec error: ${error}`);
    return;
  }
  if (stdout) {
    console.log(`stdout: ${stdout}`);
  }
  if (stderr) {
    console.log(`stderr: ${stderr}`);
  }
});
