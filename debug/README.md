# Change init params and manifest.json

#### Edit init params in `debug/index.html`

```html
<script>
  var Pushwoosh = Pushwoosh || [];
  Pushwoosh.push(["init", {
    logLevel: 'error', // possible values: error, info, debug
    applicationCode: 'XXXXX-XXXXX',
    safariWebsitePushID: 'web.com.example.test',
    defaultNotificationTitle: 'Pushwoosh',
    defaultNotificationImage: 'https://cp.pushwoosh.com/img/logo-medium.png',
    autoSubscribe: false,
    userId: 'user_id',
    tags: {
      'Name': 'John Smith'
    }
  }]);
</script>
```

#### Edit `files/manifest.json`

```json
{
  "name": "Pushwoosh Notifications",
  "short_name": "Pushwoosh Notifications",
  "gcm_sender_id": "GOOGLE_PROJECT_ID",
  "display": "standalone",
  "gcm_user_visible_only": true
}
```

# Run debug server

Change `${API_URL}` if you need to use custom api url:

```bash
npm run clean && npm run build:min -- --api ${API_URL} && npm run ci -- --manifest '{"name":"Pushwoosh Notifications","short_name":"Pushwoosh Notifications","gcm_sender_id":"GOOGLE_PROJECT_ID","display":"standalone","gcm_user_visible_only":true}' --initparams '{"logLevel":"error","applicationCode":"XXXXX-XXXXX","safariWebsitePushID":"web.com.example.test","defaultNotificationTitle":"Pushwoosh","defaultNotificationImage":"https://cp.pushwoosh.com/img/logo-medium.png","autoSubscribe":false,"userId":"user_id","tags":{"Name":"John Smith"}}' && npm run server
```

or leave it blank:

```bash
npm run clean && npm run build:min && npm run ci -- --manifest '{"name":"Pushwoosh Notifications","short_name":"Pushwoosh Notifications","gcm_sender_id":"GOOGLE_PROJECT_ID","display":"standalone","gcm_user_visible_only":true}' --initparams '{"logLevel":"error","applicationCode":"XXXXX-XXXXX","safariWebsitePushID":"web.com.example.test","defaultNotificationTitle":"Pushwoosh","defaultNotificationImage":"https://cp.pushwoosh.com/img/logo-medium.png","autoSubscribe":false,"userId":"user_id","tags":{"Name":"John Smith"}}' && npm run server
```
