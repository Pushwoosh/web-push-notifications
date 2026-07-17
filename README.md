# Pushwoosh Web Push Notification SDK

A client-side JavaScript SDK for web push notifications supporting Chrome, Firefox, and Safari. Published to npm as `web-push-notifications` and distributed via CDN.

## Getting started

### Installation

Install dependencies:

```bash
npm install
```

### Development

Start the local dev server:

```bash
npm start
```

Runs webpack-dev-server on `https://localhost:8003` with the CDN build configuration.

### Building

```bash
npm run build          # development build
npm run build:prod     # production build (minified)
npm run release        # production build + zip package
```

### Code quality

```bash
npm run check:types    # TypeScript type-check
npm run check:lint     # ESLint
npm run lint:fix       # auto-fix ESLint issues
```

## What it does

- Provides the Pushwoosh Web Push SDK for integrating browser push notifications into websites
- Handles push subscription management across Chrome, Firefox, and Safari (including legacy Safari APNs)
- Includes a Service Worker for receiving and displaying push notifications
- Ships UI widgets: subscription popup, subscription button, subscription prompt, and in-app inbox
- Communicates with the Pushwoosh backend API for device registration, event tracking, and inbox messages
- Published as:
  - **CDN**: `https://cdn.pushwoosh.com/webpush/v3/pushwoosh-web-notifications.js`
  - **npm**: [`web-push-notifications`](https://www.npmjs.com/package/web-push-notifications)
  - **GitHub**: [Pushwoosh/web-push-notifications](https://github.com/Pushwoosh/web-push-notifications)

## Integration

```html
<script src="//cdn.pushwoosh.com/webpush/v3/pushwoosh-web-notifications.js" async></script>
<script>
  var Pushwoosh = Pushwoosh || [];
  Pushwoosh.push(['init', {
    apiToken: 'YOUR_DEVICE_API_TOKEN',
    applicationCode: 'XXXXX-XXXXX',
    defaultNotificationTitle: 'Pushwoosh',
    autoSubscribe: true
  }]);
</script>
```

## Key dependencies

- TypeScript, Webpack 5, Babel
- No runtime framework dependencies (vanilla JS/TS)
- `@pushwoosh/logger` (internal)

## Links

- [Integration Guide](https://docs.pushwoosh.com/developer/pushwoosh-sdk/web-push-notifications/web-push-sdk-30/)
- [Sample Project](https://github.com/Pushwoosh/web-push-notifications-sample)
- [npm Package](https://www.npmjs.com/package/web-push-notifications)
