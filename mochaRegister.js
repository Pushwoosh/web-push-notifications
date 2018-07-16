require('ts-node/register');

global.navigator = {
  serviceWorker: {}
};
global.window = {
  PushManager: {},
  Notification: {},
  indexedDB: {},
  localStorage: {}
};

global.indexedDB = {
  open: () => ({
    onsuccess: () => {}
  })
};
