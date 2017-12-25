# Change init params and manifest.json

#### Clone the `develop/config.default.js` to a `develop/config.js` and edit it

```js
module.exports = {
  manifest: {
    name: 'Pushwoosh Notifications',
    short_name: 'Pushwoosh Notifications',
    gcm_sender_id: 'GOOGLE_PROJECT_ID',
    display: 'standalone',
    gcm_user_visible_only: true
  },

  initParams: {
    logLevel: 'info',
    applicationCode: 'XXXXX-XXXXX',
    safariWebsitePushID: 'web.com.example.test',
    defaultNotificationTitle: 'Pushwoosh',
    defaultNotificationImage: 'https://cp.pushwoosh.com/img/logo-medium.png',
    autoSubscribe: false,
    userId: 'user_id',
    tags: {
      Name: 'John Doe'
    },
    driversSettings: {
      worker: {
        serviceWorkerUrl: 'pushwoosh-service-worker.uncompress.js'
      }
    }
  },

  ssl: {
    key: '', // absolute path to key
    cert: '' // absolute path to cert
  }
};
```

## Build development

```bash
npm run build
```

## Build production

```bash
npm run build:prod
```

## Run server

```bash
npm run start
```

## Prepare release files

```bash
npm run release
```
