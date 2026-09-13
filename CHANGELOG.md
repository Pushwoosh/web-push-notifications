# Changelog

Entries start at 3.71.0; for earlier versions see the git history and the
[GitHub releases](https://github.com/Pushwoosh/web-push-notifications/releases).

## 3.76.0

- Widget colours are validated by the browser instead of a regexp, so the values it accepts —
  `rgb()`/`rgba()`, `hsl()`, named colours, `#rgba`/`#rrggbbaa` — are drawn as configured instead of
  being replaced with the dark grey fallback. A value that would break out of the declaration
  (`;`, `{`, `}`) is still refused, as is anything the browser rejects.

## 3.75.0

- App Inbox draws the four cell layouts the control panel now produces: `classic`, `banner`,
  `captioned` and `carousel`. The layout and its media travel in `action_params.u` under the
  iOS names (`displayType`, `carousel[].image`, `carousel[].title`), the hero image in
  `action_params.b`. A layout that cannot render degrades to `classic`, as in the campaign preview.
- `IInboxMessagePublic` gains `layout`, `iconUrl`, `heroUrl`, `carousel` and `customData`, so an
  integration drawing its own inbox has everything the built-in widget has, the campaign's custom
  data included. `imageUrl` keeps carrying the small avatar.
- Opening the inbox widget now refreshes it from the server, at most once every 30 seconds. A
  standalone App Inbox message travels on a channel with no push, so nothing else announced one
  between page loads.
- New `inboxWidget` options for the layouts: `unreadDotColor`, `avatarBgColor`, `avatarTextColor`,
  `avatarSize`, `mediaRadius`, `slideCaptionColor`, `slideScrimColor`, `pagerDotActiveColor` and
  `pagerDotColor`.
- Campaign content in the inbox widget is HTML-escaped. A title, body, slide caption or image URL
  used to reach the page as markup, so a message could inject an element with a live event handler.
- Links whose scheme runs script in the page origin (`javascript:`, `vbscript:`, `data:`, `blob:`,
  `file:`) are refused, both for a message action and for a carousel slide.
- Fixed in the inbox widget: a message with no title rendered the literal text `null`; a malformed
  `action_params` on one message hid every other message in the inbox; deleting a message discarded
  the pending read receipts of all the others; the scroll handler was never removed when the widget
  closed; and each re-render leaked the elements of the previous one.

### Breaking

- `sendDate` on a public inbox message is now a true UTC instant. It used to carry local wall-clock
  time labelled `Z`, so code that compensated for the old value will be off by its timezone offset.
  The built-in widget is unaffected.
- Tapping an inbox message with a relative link now navigates to it. It previously did nothing at
  all, because the link was handed to `history.go`, which takes a number of history entries.
- Markup inside inbox message content now renders as text; see the escaping entry above.
- TypeScript: the five new fields on `IInboxMessagePublic` are required, and `IInboxMessages` gains
  `syncMessages()`. Code that only reads inbox messages is unaffected; code that implements either
  interface or builds these objects (test doubles, custom inbox wrappers) needs updating.
- `inboxWidget.legacyClassicCell: true` restores the previous look of the classic cell: the 40px
  icon column instead of a 52px rounded avatar, no unread dot, and an unclamped body. The three new
  layouts are unaffected.

## 3.74.0

- Init stops instead of firing every doomed request when the Pushwoosh API rejects the application
  code (`status_code` 210): no further init steps, no `ready`, and one `Logger.error` naming the
  applicationCode and the code. An ordinary per-call or network failure still leaves init running
  to `ready`.
- API failures now arrive as `ApiRequestError` carrying the application `status_code` as a field,
  from both the HTTP-level and the body-level branch of the response check.

## 3.73.0

- Requests that need an hwid are no longer sent without one. Where the SDK storage keeps no hwid
  (in-app webview, private window, insecure context) every device-bound call used to leave with an
  empty hwid and be rejected by the backend; the whole class now stops inside the SDK, with the
  reason logged once.
- Email, SMS and WhatsApp keep working there: they are registered against the userId, which is taken
  from the init params when the storage has none to give.

## 3.72.0

- The `pushwoosh-widget-subscription-prompt` bundle is no longer fetched for visitors who would never
  see the prompt: applications on the `not-used` use case (their own prompt), visitors whose display
  capping is exhausted, and the `not-set` use case with `autoSubscribe: false`. The decision is taken
  in the main bundle before the request, and every skip is logged with its reason.
- If the decision itself fails (no features loaded, a storage error), the bundle is fetched as before
  and the widget decides for itself — the gate never hides the prompt on an error.

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
