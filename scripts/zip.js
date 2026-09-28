const fs = require('fs');
const path = require('path');

const archiver = require('archiver');

const { version } = require('../package.json');

const distPath = path.normalize(path.resolve(__dirname, '..', 'output/zip'));
const zipName = `PushwooshWebSDK-${version}.zip`;

const output = fs.createWriteStream(zipName);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', function () {
  console.log(archive.pointer() + ' total bytes');
});

archive.on('error', function (err) {
  throw err;
});

archive.pipe(output);
archive.directory(distPath, false);
archive.finalize().then(() => {
  fs.rename(zipName, path.resolve(distPath, zipName), () => console.log(`Moved to ${distPath}`));
});
