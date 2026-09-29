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

## Web popups

Web popups are configured as campaigns in the Pushwoosh dashboard and rendered by
a separate widget bundle. It loads by default; pass `enable: false` to opt out:

```js
Pushwoosh.push(['init', {
  applicationCode: 'XXXXX-XXXXX',
  webPopups: {
    // enable: false, // opt out entirely: the bundle is never loaded
    // autoShow: false, // never show a popup automatically; see below
  },
}]);
```

### One popup at a time

At most one popup is on screen at any moment. When several campaigns match the
same page, they are shown one after another — ordered by their configured delay,
then by the order the server returned them — and the next one appears shortly
after the current one is dismissed.

### Showing a popup from your own code

A campaign can be set to **Only via WebSDK call** in the dashboard, in which case
it is never displayed automatically and it is up to the site to show it:

```js
Pushwoosh.moduleRegistry.webPopups.show('POPUP_CODE');
```

> Requires WebSDK 3.63.0 or newer. Older bundles do not understand the campaign
> trigger setting and display such popups automatically.

`show()` ignores every display condition — delay, page rules, device type,
visitor type and frequency capping — because an explicit call is an explicit
intent. It closes the currently visible popup to make room, records the same
statistics as an automatic display, and resolves `false` (never rejects) when
the code is unknown or its content cannot be loaded.

The full interface:

| Method | Description |
|---|---|
| `show(code): Promise<boolean>` | Show a popup now, ignoring all conditions. |
| `hide(code?): boolean` | Hide the visible popup, or only the given one. |
| `hideAll(): boolean` | Hide the visible popup and drop everything still pending on this page. |
| `isVisible(code?): boolean` | Whether any popup — or the given one — is on screen. |
| `getVisibleCode(): string \| null` | Code of the popup on screen. |
| `getAvailableCodes(): string[]` | Every popup code the server returned. |
| `getState(): WebPopupsState` | Snapshot of the pipeline: visible / queued / waiting / available. |

`autoShow: false` in the init params is the site-wide equivalent of the
per-campaign setting: popups are still loaded, but the SDK never shows one by
itself.

### Knowing when the API is ready

`Pushwoosh.moduleRegistry.webPopups` appears once the widget bundle has loaded,
which happens asynchronously after init. Calls made after that point are safe
even if the popup list is still loading — they queue internally. To be sure the
object exists, wait for the `web-popups-ready` event:

```js
Pushwoosh.addEventHandler('web-popups-ready', function () {
  Pushwoosh.moduleRegistry.webPopups.show('POPUP_CODE');
});
```

### Events

| Event | Payload |
|---|---|
| `web-popups-ready` | — |
| `show-web-popup` | `{ code, trigger }` — `trigger` is `'auto'` or `'api'` |
| `hide-web-popup` | `{ code, reason }` — `reason` is `'user'`, `'api'` or `'preempted'` |

## Key dependencies

- TypeScript, Webpack 5, Babel
- No runtime framework dependencies (vanilla JS/TS)
- `@pushwoosh/logger` (internal)

## Links

- [Integration Guide](https://docs.pushwoosh.com/developer/pushwoosh-sdk/web-push-notifications/web-push-sdk-30/)
- [Sample Project](https://github.com/Pushwoosh/web-push-notifications-sample)
- [npm Package](https://www.npmjs.com/package/web-push-notifications)
