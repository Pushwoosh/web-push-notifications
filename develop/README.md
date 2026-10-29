# Change init params

#### Clone the `config/config.js` to a `config/config.local.js` and edit it

```js
module.exports = {
  initParams: {
    applicationCode: 'XXXXX-XXXXX',
    safariWebsitePushID: 'web.com.example.test',
    serviceWorkerUrl: 'pushwoosh-service-worker.uncompress.js'
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
