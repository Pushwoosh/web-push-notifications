Pushwoosh Web Push Notification SDK
=========================

[![GitHub release](https://img.shields.io/github/release/Pushwoosh/web-push-notifications.svg)](https://github.com/Pushwoosh/web-push-notifications/releases)
[![npm](https://img.shields.io/npm/v/web-push-notifications.svg)](https://www.npmjs.com/package/web-push-notifications)
![platforms](https://img.shields.io/badge/platforms-Chrome%20%7C%20Firefox%20%7C%20Safari-green.svg)


| [Download](https://cdn.pushwoosh.com/webpush/v3/PushwooshWebSDKFiles.zip) | [Guide](https://docs.pushwoosh.com/developer/pushwoosh-sdk/web-push-notifications/web-push-sdk-30/) | [Sample](https://github.com/Pushwoosh/web-push-notifications-sample) | [NPM Package](https://www.npmjs.com/package/web-push-notifications) |
|---------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------|----------------------------------------------------------------------|---------------------------------------------------------------------|


### Integration
- Download Pushwoosh Web Push SDK and unzip it. You should have the following files: `pushwoosh-service-worker.js`

- Place all these files to top-level root of your website directory.

### Installation

via html
```html
<script type="text/javascript" src="//cdn.pushwoosh.com/webpush/v3/pushwoosh-web-notifications.js" async></script>
<script type="text/javascript">
  var Pushwoosh = Pushwoosh || [];
  Pushwoosh.push(['init', {
    apiToken: 'XXXXXXX', //  Device API Token
    applicationCode: 'XXXXX-XXXXX', // you application code from Pushwoosh Control Panel
    safariWebsitePushID: 'web.com.example.domain', //  unique reverse-domain string, obtained in you Apple Developer Portal. Only needed if you send push notifications to Safari browser
    defaultNotificationTitle: 'Pushwoosh', // sets a default title for push notifications
    defaultNotificationImage: 'https://yoursite.com/img/logo-medium.png', // URL to custom custom notification image
    autoSubscribe: true, // or false. If true, prompts a user to subscribe for pushes upon SDK initialization
    subscribeWidget: {
      enable: true
    },
    userId: 'user_id', // optional, set custom user ID
  }]);
</script>
```

| [Chrome Guide](https://www.pushwoosh.com/docs/chrome-web-push) | [Firefox Guide](https://www.pushwoosh.com/docs/firefox-web-push) | [Safari Guide](https://www.pushwoosh.com/docs/safari-website-notifications) | [HTTP integration Guide](https://www.pushwoosh.com/docs/chrome-web-push-for-http-websites) | [Subscription Button Guide](https://www.pushwoosh.com/v1.0/docs/push-subscription-button) |
| -------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |

