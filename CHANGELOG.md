# Changelog

Entries start at 3.71.0; for earlier versions see the git history and the
[GitHub releases](https://github.com/Pushwoosh/web-push-notifications/releases).

## 3.71.0

- The SDK no longer requires push notifications to work. `initialize()` used to bail out before
  `finishInit()` when the browser could not receive notifications, so `ready` never fired and every
  widget stayed silent — including web popups and inbox, which need no push at all. Push is now a step
  inside init instead of a precondition for it.
- New init parameter `pushNotifications` (default `true`). `false` turns the push part off entirely: no
  service worker registration, no permission request, no auto-resubscribe, no subscription widgets.
  Popups, inbox, events and tags keep working. Already subscribed devices are **not** unregistered
  automatically — call `Pushwoosh.unsubscribe()` for that.
- New public method `isPushAvailable(): boolean` — lets a site tell "push is off or unsupported" from
  "the user declined".

### ⚠️ Breaking type change for TypeScript consumers of the npm package

`Pushwoosh.driver` is now `IPushService | undefined`. The declarations shipped as `types: npm.d.ts` are
generated from the class, so TypeScript consumers with `strictNullChecks` that touch `pushwoosh.driver.*`
directly get a new compile error and need a guard — preferably the new `isPushAvailable()`.

Runtime behaviour is unchanged: the field could already be `undefined` in practice (Safari without
`safariWebsitePushID`, an application without VAPID) — the type simply lied about it.
