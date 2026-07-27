export default {
  initParams: {
    logLevel: 'info',
    applicationCode: 'XXXXX-XXXXX',
    apiToken: 'abcdxyz',
    safariWebsitePushID: 'web.com.example.test',
    defaultNotificationTitle: 'Pushwoosh',
    defaultNotificationImage: 'https://cp.pushwoosh.com/img/logo-medium.png',
    autoSubscribe: false,
    userId: 'user_id',
    serviceWorkerUrl: 'pushwoosh-service-worker.js',
    tags: {
      Name: 'John Doe',
    },
    subscribeWidget: {
      enable: true,
    },
    webPopups: {
      enable: true,
      // Uncomment to test the manual-only mode: nothing shows by itself, the
      // page drives everything through moduleRegistry.webPopups.show(code).
      // autoShow: false,
    },
  },

  ssl: {
    key: '', // absolute path to key
    cert: '', // absolute path to cert
  },
};
