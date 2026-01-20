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
  },

  ssl: {
    key: '', // absolute path to key
    cert: '', // absolute path to cert
  },
};
