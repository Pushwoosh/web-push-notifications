# Changelog

Each entry is headed by the title of the merge request that brought the change, newest first. The
version is not known while an MR is open -- it is decided when the release tag is cut -- so an entry
never carries one. To find the release an entry shipped in, run `git tag --contains <its commit>`;
the same mapping is in the
[GitHub releases](https://github.com/Pushwoosh/web-push-notifications/releases).

Entries for 3.71.0 through 3.78.0 are grouped under version headings, which is how this file was
kept before the version moved to the tag; earlier versions live only in the git history.

## fix(web-popups): do not count the FORM content Submit as an interaction

- An interaction (`recordPopupFormEvent`, event 3) is a click on a link or a button of the content, except the ✕ and
  the FORM content Submit (its send counts in Submits). The panel's Interactions column adds Submits to interactions,
  so a FORM send was counted twice. The email-subscription-form submit and the choice and rating buttons still count.
- `@pushwoosh/websdk-common` 6.25.0.

## feat(web-popups): show web content by push permission status

- A web content campaign with `push_permission_status` (`DEFAULT`, `GRANTED`, `DENIED`, `UNSUPPORTED`) shows only to
  visitors whose push permission, as the SDK reports it in the `Push Permission Status` tag, matches. `ALL`, an empty or
  an unknown value shows to everyone. A core without the public `getPushPermissionStatus()` (an npm SDK older than the
  CDN widget) or a status that cannot be read shows only `ALL` campaigns.
- When the permission changes on the page, waiting and queued popups and inline blocks that stopped matching are
  removed; the popup on screen stays. A campaign that starts to match shows on the next page or after a reload.
- `show(code)` checks the status after the "already on screen" answer and before loading the content; a content code
  without a campaign is not checked.
- `Pushwoosh.getPushPermissionStatus()` is public. A campaign condition reads its values as `not_determined` → `DEFAULT`,
  `granted_explicit` → `GRANTED`, `denied` → `DENIED`, `unsupported` → `UNSUPPORTED`. New event `change-permission` with
  `{ permission }`: once per change, from the subscribe() dialog answer or from the site settings while the page is open.
- An inline block is removed when its subscribe button closes it (granted with no setting, or the "Close" result);
  navigation brings an auto block back, a `show()` block needs a new `show()`. Button result problems are logged.
- A click on a link or a button inside a campaign's popup or inline block is recorded as an interaction
  (`recordPopupFormEvent`, event 3, with a new `clickId` per click); the ✕, the overlay, text, inputs and labels are not.
- Older SDKs ignore `push_permission_status` and show such campaigns to everyone.
- `@pushwoosh/websdk-common` 6.24.0.

## feat(events): send the page path in PW_SiteOpened and match page rules against it

- `PW_SiteOpened` carries a new attribute `path`: the page path without the domain, query and hash, decoded to
  readable form and lowercased (`/catalog/shoes/`, `/каталог/обувь`). A path that does not decode is sent as it
  is, lowercased. `url`, `title` and `device_type` are unchanged: `url` stays the full address, encoded as the
  browser gives it. The event sent at init and `sendPostEventVisitedPage()` carry `path`; `postEvent('PW_SiteOpened', …)`
  sends only what the site passes.
- Web campaign page rules (`matching_page_rules`, `matching_pages`, `excluded_pages`) are compared with the same
  page path, and the rule path is lowercased: rules with non-Latin letters, a dot or a space match their pages, and
  case no longer matters. Lowercase Latin rules match the same pages as before.
- The web popups debug log names the page path the rules were compared with.

## feat(usage): report which init keys and events a site uses

- Once a day per browser, when the page is hidden, the SDK sends `/json/1.3/sdkUsage`: names of the
  `init` keys (one level deep), events subscribed through `addEventHandler` and legacy `push(['on…'])`
  events. Values are never sent; a failed report is dropped silently.
- SDK widgets subscribe through `addSdkEventHandler`, so their own handlers are not counted as the site's.

## feat(safari): choose the Safari push path by the live subscription, not by unifiedPlatform

- A Safari visitor with a live legacy (Website Push ID) subscription keeps it, `device_type` 10.
- Any other Safari visitor subscribes through the service worker as `device_type` 11 when the app has
  its own web VAPID keys (`getConfig` → `web_vapid_configured`) or `unifiedPlatform` is on; without
  either, Safari stays on the legacy path, as before, so the FCM fallback key never ends up in a Safari subscription.

## feat(web-popups): submit web content forms to submitPopupForm

- A FORM web content (email input, tag inputs, consent, submit) sends its values in one request to
  `/json/1.3/submitPopupForm`, under the code of the campaign that shows it and with the visitor's hwid.
  The same content in a popup and in an inline block submits under each campaign's own code.
- `OK` opens the Success page, `INVALID_EMAIL` shows the email input's invalid message. Any other answer
  or a network error shows the Submit error, and the visitor can submit again.
- Nothing is sent while communication is disabled.
- A content with form fields opened without a campaign (inbox `wp`, `show(<content code>)`) is not shown:
  `show()` logs and resolves `false`, and the inbox follows the message link as before.
- `@pushwoosh/websdk-common` 6.22.1.

## feat(widgets): load widgets from the bundle's own host, version widget URLs

- The CDN bundle loads widgets from the folder it was itself loaded from, or from `cdn.pushwoosh.com/webpush/v3/` when that folder is unknown.
- Widget URLs carry the SDK version (`?v=`), so a cached bundle never pairs with widgets of another release.

## feat(web-popups): render EMBEDDED web campaigns inside a page element

- A web campaign with `kind: 'EMBEDDED'` renders as a block inside the first element its `css_selector`
  matches, instead of over the page, stretched to the element's full width (the page width is ignored).
  Images are capped at 360px high and cropped to cover; text and buttons are never clipped.
  No close icon; close-action buttons are not drawn and a `hide-popup` countdown does not remove the block.
- EMBEDDED follows device type, visitor type, page rules and the trigger setting, but has no delay
  and no frequency. `webPopups.autoShow: false` and API-triggered campaigns leave it to `show(code)`.
- Several campaigns with the same selector stack in server order. A missing element or an invalid
  selector skips the campaign silently.
- On SPA navigation the blocks follow the page rules: removed when the rules stop matching, rendered
  again when they match. A block shown by `show(code)` stays across navigation and is removed only when
  its element leaves the page. An element added later is not watched: the SDK looks for it on load and
  on each navigation, otherwise call `show(code)` once it is on the page. VISIT is reported once per
  page load, at the first render; IMPRESSION and subscription form views once per page load, when the
  block first enters the viewport.
- The `auto` color scheme follows OS theme changes while the block is on the page.
- A missing or unknown `kind` keeps the popup behavior.

## feat(recommendations): onsite product recommendations widget and API

- `Pushwoosh.trackProductView({id, name, price, currency, category, url, imageUrl})` sends `PW_ProductView`
  (one event per product in 30 s), the input of the "viewed" recommendations and of the product pairs.
- `Pushwoosh.recommendations.fetch({strategy, fallback, limit, productId, exclude, block})` reads the public onsite
  feed (`/feed/v1/onsite/products.json`, the application opts in on the server); the hwid goes in the
  `X-PW-HWID` header, and without communication consent the request is anonymous.
- `Pushwoosh.recommendations.trackClick({block, strategy, productId, position})` sends `PW_RecommendationClick`
  with `keepalive`, the product under `recoProductId` so a click does not feed the recommendations themselves.
- New widget bundle `pushwoosh-widget-recommendations.js`: loaded only once a `[data-pw-recommendations]` block is
  on the page (checked once when the SDK is ready; with `recommendations.spa: true` also when an SPA adds one later), renders into shadow DOM, themed by `--pw-reco-font`,
  `--pw-reco-accent`, `--pw-reco-radius`, `--pw-reco-columns`, reports `data-pw-state`
  (`loading`/`ready`/`empty`/`error`) and re-renders on a data attribute change. `recommendations.widget: false`
  in the init params keeps it off; `recommendations.endpoint` points it at another feed.

## fix(push): report permission changes with registerDevice

- A refusal in the permission dialog, or a permission change reported by `navigator.permissions`, now goes
  to the server as a registerDevice without a push token instead of an extra `applicationOpen`, which the
  server counted as one more app open. It is sent only for a device without a push token, after a
  subscription in flight has been answered, and once per status: the last status the server got is kept
  in `localStorage` (`reportedPushPermissionStatus`), so a page load does not repeat it.
- A permission revoked or reset in the site settings while the page is open drops the subscription right
  away (as the next init would) and reports the new status; after init the status is reported too, so a
  revoke noticed on reload, or a grant without a subscription, no longer waits for the hourly
  `applicationOpen`.
- A permission granted in the dialog is reported only by the subscription's own registerDevice: the
  `change` event that fires first waits for the subscription instead of sending a tokenless report that
  could land after it and clear the token. It waits at most 10 s, and so does the re-subscribe after a
  grant in the site settings and the unsubscribe after a revoke. A subscription, unsubscribe or
  registerDevice that hangs is waited for once: the next permission change on the page is reported
  right away (a revoke as a tokenless registerDevice, the dead token may be cleared), and a report that
  would overtake a hanging registerDevice is dropped rather than risk clearing its token. A grant in the site settings re-subscribes a device the SDK
  dropped on a revoke (not one the user unsubscribed manually), as the next init would.
- A reload after a permission change sends one `unregisterDevice` instead of two: init no longer asks the
  server whether the device it has just unregistered still has a token.

## feat(push): report push permission status

- `applicationOpen` and `registerDevice` carry `push_permission_status`: `not_determined`, `granted_explicit`,
  `denied`, or `unsupported` when the browser has no Push API (iOS Safari outside a home screen app).
  The legacy Safari driver reports its own permission the same way.
- An `applicationOpen` goes right after the permission dialog closes, past the hourly throttle, and on a
  change of the notifications permission where `navigator.permissions` reports one (Chromium, Firefox).

## fix(feature-flags): serve the cached flags from onReady

- The flags cache is read from IndexedDB before `ready` fires, so `get()`/`isEnabled()` called in
  `onReady` return the cached flags instead of `null`.
- A flag read before the cache finished loading is followed by an update-listener call once the cache
  is there, also when the page-load refresh is skipped (cache younger than 15 minutes) or answers
  `not_modified`.

## feat(feature-flags): add the feature flags client

- `Pushwoosh.featureFlags` reads the application's feature flags that the server evaluates for the
  device: `get(key)` with typed getters and defaults, `isEnabled`, `refresh()`, update listeners and
  `logImpression(key)` (`PW_FeatureFlagImpression`).
- Nothing goes to the network until the site first calls the flags API on a page; sites that do not
  use feature flags send no requests.
- Flags come from `/api/v2/device-api/getFeatureFlags` on the current API host, are cached in
  IndexedDB per User ID for up to 24 hours with an etag, and refresh on the first use of a page when
  the cache is older than 15 minutes, hourly while the page is open, after the first device
  registration and right after the User ID changes.

## fix(web-sdk): take legacy panel modules from web_sdk_modules

- A legacy (snippet) application now gets its panel `inboxWidget`/`webPopups` from the
  `web_sdk_modules` feature, and only those two keys are taken from it. `web_sdk` keeps meaning
  "panel-managed", so the Control Panel Subscription Prompt stays on for a legacy site that switched
  a module in the panel.

## fix(inbox): open the web popup content an inbox message points to

- Tapping an App Inbox message that opens a web popup now shows it when the message carries a popup
  content code (the inbox wizard and the journey Send Inbox point pick a content, not a campaign).
  Campaign codes work as before; a content shown this way records no popup campaign stats, the tap is
  counted as the inbox open.
- The web popups bundle is fetched on such a tap when the site did not load it (no active popup
  campaigns); `webPopups.enable: false` still keeps it off. If the popup cannot be shown, the message
  link is followed as before.
- `moduleRegistry.webPopups.show(code)` accepts a popup content code as well.

## feat(web-popups): take the web popups switch from the panel

- An application in the panel-managed mode gets `webPopups.enable` from the Control Panel, so support
  can switch web popups off for a site without a snippet change; `colorScheme` and `autoShow` stay as
  the snippet set them.
- `webPopups.enable: false` and `inboxWidget.enable: false` now also stop a widget an npm site
  constructs itself, not only the CDN loader.
- A missing inbox trigger element is reported by its id, with where to change it.

## feat(inbox): take the inbox widget from the panel in managed mode

- An application in the panel-managed mode gets `inboxWidget` from the Control Panel: its keys
  override the snippet ones, and keys the panel does not carry (usually `triggerId`, `appendTo`) stay
  as written in the snippet. Legacy mode is unchanged.
- An inbox switched on only in the panel now registers the device before the first inbox sync, as one
  enabled in the snippet always did.

## perf(npm): take preact from the consumer instead of bundling it per widget

- The npm `widget-inbox`, `widget-subscription` and `widget-web-popups` builds import `preact`,
  `preact/compat` and `preact/jsx-runtime` instead of each inlining its own copy, so an app bundling
  all three ships preact once (−12K gz in a consumer bundle of the three). The CDN and zip builds are
  unchanged.
- `preact` moves to `peerDependencies` at `^10.29.0`, the version the widgets are built and tested with, so
  the app and the widgets resolve the same copy. npm 7+ installs it automatically.

## feat(inbox): render the inbox widget with @pushwoosh/websdk-common

- The inbox widget is drawn by `InboxWidgetReader` from `@pushwoosh/websdk-common/inbox`, the same
  renderer the control panel previews use, so a cell looks on the site the way the campaign editor
  shows it. The markup, the class names and the `--pw-inbox-*` custom properties are unchanged.
- The widget config texts `title`, `emptyInboxTitle` and `emptyInboxText` are rendered as text: markup
  in them used to be injected into the page as HTML and now shows literally. Campaign texts were
  already escaped and are unchanged.
- The cell layout (`layout` of `pwinbox` messages) is resolved by the shared model; the rules are unchanged. Built on `@pushwoosh/websdk-common` 6.19.

## fix(widgets): keep the snippet bell off once the panel saved the subscription widget

- A `subscriptionWidget` saved in the panel now switches `subscribeWidget` and `subscribePopup`
  off even while both of its parts are off: the panel has no controls for the older widgets, so
  turning the unified widget off used to bring back a bell or popup from the site's snippet.

## feat(widgets): switch the subscription prompt and bell independently

- `subscriptionWidget` now has two switches, `prompt.enabled` and `launcher.enabled`; the widget
  loads, and the three older subscription widgets stay off, while either is on. Both are drawn at
  once when both are on. The pre-split `enable` and `launcher.size` are no longer read; an init
  snippet still passing `enable` gets the older widgets and an info line in the console naming the new switches.
- With the prompt off, a click on the bell asks the browser for the permission directly; once
  notifications are blocked the click does nothing and the bell's tooltip explains why.
- The bell takes `launcher.imageUrl`, a picture drawn instead of the round button, and
  `launcher.width`/`launcher.height` (16–200 px, default 48) instead of `launcher.size`, and its
  own colours, `launcher.background` and `launcher.iconColor` (default: the accent and its label colour). Built on
  `@pushwoosh/websdk-common` 6.18.

## chore(deps): bump @pushwoosh/websdk-common to 6.17.1

- The subscription widget hides its bell while the prompt is open and shows it again once the prompt
  closes. Drawn together they overlapped: a prompt in the bell's corner (bottom-right is the default
  for both) or a top card on a narrow screen covered the bell.

## fix(widgets): skip the Subscription Prompt for panel-managed applications

- An application whose Web SDK settings are managed in the Control Panel (the server sends it the
  `web_sdk` feature) no longer loads the Subscription Prompt: the panel configures the unified
  subscription widget for it instead. Applications configured by the init snippet are unchanged.
  The prompt settings saved for a managed application are not carried over to the new widget.

## feat(widgets): add the unified subscription widget

- New widget `pushwoosh-widget-subscription` (npm: `web-push-notifications/widget-subscription`),
  configured by the `subscriptionWidget` init param or from the Control Panel: a launcher bell plus
  a prompt drawn as a card, a full-width bar or a modal, opened after a delay with capping by count and
  hours, only from the bell, or only through `Pushwoosh.moduleRegistry.subscriptionWidget`
  (`show`/`hide`/`toggle`/`isVisible`). A visitor who blocked notifications gets an explanation of how
  to unblock them instead of the ask. It renders in a shadow root with the renderer from
  `@pushwoosh/websdk-common/subscription-widget`, the same code the Control Panel previews with.
- While `subscriptionWidget.enable` is true, `subscribeWidget`, `subscribePopup` and the Subscription
  Prompt are not loaded, so a page never shows two asks. With it off nothing changes for them.
- Opening the prompt dispatches `show-subscription-widget`, closing it `hide-subscription-widget` —
  the events the Subscription Prompt already fires.
- In panel-managed mode `subscriptionWidget` is taken from the panel as a whole, not merged key by key
  like `subscribeWidget`.

## chore(deps): switch smart-blocks-utils to @pushwoosh/websdk-common/web-popups

- The web popups widget now takes its renderer from `@pushwoosh/websdk-common/web-popups`, the same
  code the smart-blocks editor previews with, instead of `smart-blocks-utils`. Rendering is unchanged;
  the widget bundle is about 6 KB smaller.

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
