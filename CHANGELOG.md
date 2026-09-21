# Changelog

Each entry is headed by the title of the merge request that brought the change, newest first. The
version is not known while an MR is open -- it is decided when the release tag is cut -- so an entry
never carries one. To find the release an entry shipped in, run `git tag --contains <its commit>`;
the same mapping is in the
[GitHub releases](https://github.com/Pushwoosh/web-push-notifications/releases).

Entries for 3.71.0 through 3.78.0 are grouped under version headings, which is how this file was
kept before the version moved to the tag; earlier versions live only in the git history.

## fix(config): let the Control Panel settings win over the init snippet

- When an application is switched to panel-managed mode, a value saved in the Control Panel now
  overrides the same parameter in the site's init snippet. Moving a site to panel configuration is
  therefore a switch in the panel, with no edit of the site's code.
- Keys the panel does not carry are still left to the snippet, and `subscribeWidget` is still merged
  key by key — the panel owns the keys it sets, the snippet keeps the rest.

## fix(init): stop unregistering a device that a first visit never registered

- A first page load sent `/unregisterDevice` for a visitor who had never subscribed. Two separate
  checks read "nothing stored yet" as "it changed": `checkIsNeedResubscribe` compared the browser
  permission against a `lastPermissionStatus` that no visit had written, and `loadConfig` compared
  the VAPID key from `/getConfig` against an `applicationServerKey` that no visit had written.
  Either one made `defaultProcess` resubscribe, and resubscribing starts with an unsubscribe.
  Both now treat an absent stored value as "no change", the way the Safari driver already guarded
  `webSitePushId`. A permission that really changed, a push token out of sync with the store and a
  VAPID key that really was replaced still resubscribe.
- Beyond the wasted request, `PushServiceDefault.unsubscribe()` sets the manual-unsubscribed flag
  on its way through, which left a brand-new visitor marked as having opted out for the two
  network round trips it took `defaultProcess` to set it back.
- `Api.checkDevice` is now memoised per page, like `ensureDeviceRegistered` already was. Init asked
  `/checkDevice` twice on every load -- once for the subscription status, once before registering
  the device for the inbox and web popups. Registering, unregistering and deleting the device drop
  the memo, and so does `multiRegisterDevice` when the request carried a push device -- it
  registers the same hwid.
- `checkDeviceSubscribeForPushNotifications` tested its cached status with
  `typeof status === 'undefined'`, but `localStorage.getItem` returns `null`, so the branch never
  ran: with no stored status the method answered "not subscribed" without asking the backend.
  `Pushwoosh.isSubscribed()` is the public caller that saw it.

## feat(config): take Web SDK settings from the Control Panel

- The SDK asks `/getConfig` for a new `web_sdk` feature and applies what comes back to its init
  parameters: `autoSubscribe`, `defaultNotificationTitle`, `defaultNotificationImage`,
  `safariWebsitePushID` and `subscribeWidget`. The backend serves it only for applications switched
  to the panel-managed mode, so a site that was not switched sees no change at all.
- A value written in the init snippet always wins over the server; the server only fills what the
  integrator left out. `subscribeWidget` is merged key by key, so a panel form that sets one field
  does not drop the rest of the snippet's widget.
- `IResponseGetConfig` now types the new feature and spells the prompt use case `use_case`, which is
  what the backend has always sent and what the widget code has always read.

## chore(api): drop page_visit and web_in_apps from the config request

- The SDK no longer asks `/getConfig` for the `page_visit` and `web_in_apps` features. The backend
  has no case for either name and silently drops them from the response, so `features.page_visit`
  was always absent and the page-visit statistics call it gated never had an entrypoint to post to.
- Gone with that dead branch: the `sendStatisticsVisitedPage()` method on the `Pushwoosh` instance,
  the `pageVisit` API and ApiClient methods and the `PAGE_VISITED_URL` storage key. A page calling
  `sendStatisticsVisitedPage()` by hand got a no-op before this change too.
- The `PW_SiteOpened` event, which is what actually reports a page view, is untouched.

## feat(inbox): open the web popup an entry carries in action_params.wp

- An App Inbox message can open a web popup instead of a link. Standalone inbox entries for web
  platforms carry the popup form code in `action_params.wp` (the web counterpart of `rm`), and a tap
  on such a message shows that popup through the web popups widget, closing the inbox panel first.
- The entry still carries `l`, which stays the fallback: a site that does not load the web popups
  widget, or a popup code the widget refuses (an inactive form, or one whose own audience segment
  this visitor is not in), navigates exactly as before.
- Public inbox messages gained `webPopupCode` — the code a tap opens, empty for every other message.

## feat(web-popups): service the subscribe button action

- A `subscribe`-action button inside a web popup now asks for the push permission instead of doing
  nothing. The popup is told the resulting permission (`granted`/`denied`/`default`), so a
  registration that fails after a granted prompt does not read to it as a refusal.

## 3.78.0

- The App Inbox hero image is drawn in a 2:1 aspect ratio instead of 9:4. An image uploaded to the
  ratio the control panel recommends (`1200x600`) is now shown whole; previously `object-fit: cover`
  cropped about 11% of its height. Nothing else in the cell geometry changed.

## 3.77.0

- Widget styling is applied through real CSS custom properties on the widget root
  (`--pw-inbox-*` on `#pwInboxWidget`, `--pw-popup-*` on `#pwSubscribePopup`) instead of the values
  being substituted into the stylesheet text before the browser sees it. Defaults, `inboxWidget`
  and `subscribePopup` field names and the rendered result are unchanged.
- Those prefixed names are a **supported public API**: a page may override any of them from its own
  CSS, and they will only be renamed with a major version bump. Every declaration carries the
  default as its `var()` fallback, so an override is additive and a value the browser refuses is
  left unset rather than collapsing the declaration.
- A value with `;`, `{` or `}` can no longer break out of its declaration, including the
  `subscribePopup` fields that used to reach the stylesheet as raw text (`boxShadow`, `textSize`,
  `textWeight`, `fontFamily`, the button radii and weights).
- The widgets now depend on CSS custom properties at runtime, which they did not before —
  substitution used to happen in JS. Support is universal in every browser the SDK runs in.

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
