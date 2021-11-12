const path = require('path');
const fs = require('fs');
const {version} = require('../package.json');
const archiver = require('archiver');


const distPath = path.normalize(path.resolve(__dirname, '..', 'dist'));
const zipName = `PushwooshWebSDK-${version}.zip`;

const output = fs.createWriteStream(zipName);
const archive = archiver('zip');

output.on('close', function () {
  console.log(archive.pointer() + ' total bytes');
  console.log('archiver has been finalized and the output file descriptor has closed.');
});

archive.on('error', function(err){
  throw err;
});

archive.pipe(output);
archive.directory(distPath, false);
archive.finalize();

fs.rename(zipName, path.resolve(distPath, zipName), () => console.log('Moved to dist'));
