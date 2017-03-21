const fs = require('fs');
const path = require('path');

const argv = process.argv;

const knownArguments = {
  '--manifest': {
    filePath: path.resolve('debug/manifest.json'),
    defaults: JSON.stringify({
      "name": "Pushwoosh Notifications",
      "short_name": "Pushwoosh Notifications",
      "gcm_sender_id": "GOOGLE_PROJECT_ID",
      "display": "standalone",
      "gcm_user_visible_only": true
    })
  },
  '--initparams': {
    filePath: path.resolve('debug/index.html'),
    replaceFrom: 'var INIT_PARAMS = .*}',
    replaceFromPrefix: 'var INIT_PARAMS = ',
    defaults: JSON.stringify({
      "logLevel": "error", // possible values - error, info, debug
      "applicationCode": "1730C-121AE",
      "safariWebsitePushID": "web.com.example.test",
      "defaultNotificationTitle": "Pushwoosh",
      "defaultNotificationImage": "https://cp.pushwoosh.com/img/logo-medium.png",
      "autoSubscribe": false,
      "userId": "user_id",
      "tags": {
        "Name": "John Smith"
      }
    })
  }
};

function replaceInFile(filePath, replaceFrom, replaceTo, replaceFromPrefix) {
  function replacer(match) {
    console.log("Replacing in %s: %s => %s", filePath, match, replaceTo);
    return replaceFromPrefix + replaceTo;
  }
  const str = replaceFrom ? fs.readFileSync(filePath, "utf8") : null;
  const out = replaceFrom ? str.replace(new RegExp(replaceFrom, "gi"), replacer) : replaceTo;
  fs.writeFileSync(filePath, out);
}

Object.keys(knownArguments).forEach(key => {
  const argIndex = argv.indexOf(key);
  const argValue = ~argIndex && argv[argIndex + 1] || '';
  const keyConfig = knownArguments[key] || {};
  const replaceTo = argValue && argValue.indexOf('--') !== 0 ? argValue : keyConfig.defaults;

  if (keyConfig.filePath && replaceTo) {
    const {replaceFrom = null, replaceFromPrefix = ''} = keyConfig;
    replaceInFile(keyConfig.filePath, replaceFrom, replaceTo, replaceFromPrefix);
  }
});
