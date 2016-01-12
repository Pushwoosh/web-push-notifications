var APPLICATION_CODE = "XXXXX-XXXXX"; // Your Application Code from Pushwoosh
var SERVICE_WORKER_URL = '/service-worker.js';
var pushwooshUrl = "https://cp.pushwoosh.com/json/1.3/";
var hwid = "";

// Try to subscribe for a push notification when page is loaded
window.addEventListener('load', function () {
	subscribe();
});


function subscribe() {
	// Check that service workers are supported, if so, progressively
	// enhance and add push messaging support, otherwise continue without it.
	if ('serviceWorker' in navigator) {
		navigator.serviceWorker.register(SERVICE_WORKER_URL)
			.then(function (serviceWorkerRegistration) {
				// Are Notifications supported in the service worker?
				if (!('showNotification' in ServiceWorkerRegistration.prototype)) {
					console.warn('Notifications aren\'t supported.');
					return;
				}

				// Check the current Notification permission.
				// If its denied, it's a permanent block until the
				// user changes the permission
				if (Notification.permission === 'denied') {
					console.warn('The user has blocked notifications.');
					return;
				}

				// Check if push messaging is supported
				if (!('PushManager' in window)) {
					console.warn('Push messaging isn\'t supported.');
					return;
				}

				serviceWorkerRegistration.pushManager.getSubscription()
					.then(function (subscription) {
						// Enable any UI which subscribes / unsubscribes from push messages.
						if (!subscription) {
							// subscribe for push notifications
							serviceWorkerRegistration.pushManager.subscribe({
								name: 'push',
								userVisibleOnly: true
							}).then(function (subscription) {
								// The subscription was successful
								pushToken = getPushToken(subscription);
								hwid = generateHwid(pushToken);
								pushwooshRegisterDevice(pushToken, hwid);
							}).catch(function (e) {
								if (Notification.permission === 'denied') {
									// The user denied the notification permission which
									// means we failed to subscribe and the user will need
									// to manually change the notification permission to
									// subscribe to push messages
									console.warn('Permission for Notifications was denied');
								} else {
									// A problem occurred with the subscription; common reasons
									// include network errors, and lacking gcm_sender_id and/or
									// gcm_user_visible_only in the manifest.
									console.error('Unable to subscribe to push.', e);
								}
							});
							return;
						}

						// Keep your server in sync with the latest hwid/pushToken
						var pushToken = getPushToken(subscription);
						hwid = generateHwid(pushToken);

						// Set your UI to show they have subscribed for push messages
						console.log("Ready to get pushes. Push token is " + pushToken);
					}).catch(function (err) {
						console.warn('Error during getSubscription()', err);
					});
			}).catch(function (err) {
				console.log('Error while service worker registration', err);
			});
	} else {
		console.warn('Service workers aren\'t supported in this browser.');
	}
}


function unsubscribe() {
	navigator.serviceWorker.ready.then(function (serviceWorkerRegistration) {
		// To unsubscribe from push messaging, you need get the
		// subscription object, which you can call unsubscribe() on.
		serviceWorkerRegistration.pushManager.getSubscription().then(
			function (pushSubscription) {
				// Check we have a subscription to unsubscribe
				if (!pushSubscription) {
					// No subscription object, so set the state
					// to allow the user to subscribe to push
					return;
				}

				var pushToken = getPushToken(pushSubscription);
				// We have a subscription, so call unsubscribe on it
				pushSubscription.unsubscribe().then(function (successful) {
					pushwooshUnregisterDevice(generateHwid(pushToken));
				}).catch(function (e) {
					// We failed to unsubscribe, this can lead to
					// an unusual state, so may be best to remove
					// the users data from your data store and
					// inform the user that you have done so
					console.log('Unsubscription error: ', e);
				});
			}).catch(function (e) {
				console.error('Error thrown while unsubscribing from push messaging.', e);
			});
	});
}

/**
 * Set tags for device
 * @param {Object} tags
 */
function setTags(tags) {
	navigator.serviceWorker.ready.then(function (serviceWorkerRegistration) {
		serviceWorkerRegistration.pushManager.getSubscription().then(
			function (pushSubscription) {
				if (!pushSubscription) {
					return;
				}

				var pushToken = getPushToken(pushSubscription);
				var hwid = generateHwid(pushToken);
				pushwooshSetTags(hwid, tags);
			}).catch(function (e) {
				console.error('Error thrown while setTags from push messaging.', e);
			});
	});
}

function createUUID(pushToken) {
	var s = [];
	var hexDigits = "0123456789abcdef";
	for (var i = 0; i < 32; i++) {
		s[i] = hexDigits.substr(pushToken.charCodeAt(i) % hexDigits.length, 1);
	}
	return s.join("");
}

function generateHwid(pushToken) {
	var hwid = APPLICATION_CODE + '_' + createUUID(pushToken);
	return hwid;
}

function getPushToken(pushSubscription) {
	var pushToken = '';
	if (pushSubscription.subscriptionId) {
		pushToken = pushSubscription.subscriptionId;
		console.log("Chrome 42, 43, 44: " + pushToken);
	}
	else {
		pushToken = pushSubscription.endpoint.split('/').pop();
		console.log("Chrome 45+: " + pushToken);
	}
	return pushToken;
}


function getBrowserVersion() {
	var ua = navigator.userAgent, tem,
		M = ua.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || [];
	if (/trident/i.test(M[1])) {
		tem = /\brv[ :]+(\d+)/g.exec(ua) || [];
		return 'IE ' + (tem[1] || '');
	}
	if (M[1] === 'Chrome') {
		tem = ua.match(/\bOPR\/(\d+)/);
		if (tem != null) return 'Opera ' + tem[1];
	}
	M = M[2] ? [M[1], M[2]] : [navigator.appName, navigator.appVersion, '-?'];
	if ((tem = ua.match(/version\/([.\d]+)/i)) != null)
		M.splice(1, 1, tem[1]);
	return M.join(' ');
}

/**
 * Call Pushwoosh registerDevice API method
 * For more information see Pushwoosh API guide http://docs.pushwoosh.com/docs/createmessage
 * @param {string} pushToken
 * @param {string} hwid
 */
function pushwooshRegisterDevice(pushToken, hwid) {
	doPushwooshApiMethod('registerDevice', {
			"application": APPLICATION_CODE,
			"push_token": pushToken,
			"language": window.navigator.language || 'en',  // Language locale of the device, must be a lowercase two-letter code according to the ISO-639-1 standard
			"hwid": hwid,
			"timezone": (new Date).getTimezoneOffset(), // offset in seconds
			"device_model": getBrowserVersion(),
			"device_type": 11
		}
	);
}

/**
 * Call Pushwoosh unregisterDevice API method
 * @param {string} hwid
 */
function pushwooshUnregisterDevice(hwid) {
	doPushwooshApiMethod('unregisterDevice', {
		application: APPLICATION_CODE,
		hwid: hwid
	});
}

/**
 * Call Pushwoosh setTags API method
 * @param {string} hwid
 * @param {Object} tags
 */
function pushwooshSetTags(hwid, tags) {
	doPushwooshApiMethod('setTags', {
		application: APPLICATION_CODE,
		hwid: hwid,
		tags: tags
	});
}

/**
 * Call Pushwoosh API method
 * @param {string} methodName
 * @param {Object} arguments
 */
function doPushwooshApiMethod(methodName, arguments) {
	console.log('Performing %s call to Pushwoosh with arguments: %s', methodName, JSON.stringify(arguments));
	try {
		var xhr = new XMLHttpRequest(),
			url = pushwooshUrl + methodName,
			params = {
				request: arguments
			};
		xhr.open('POST', url, true);
		xhr.setRequestHeader('Content-Type', 'text/plain;charset=UTF-8');
		xhr.send(JSON.stringify(params));
		xhr.onload = function () {
			if (this.status == 200) {
				var response = JSON.parse(this.responseText);
				if (response.status_code == 200) {
					console.log('%s call to Pushwoosh has been successful', methodName);
				}
				else {
					console.log('Error occurred during the %s call to Pushwoosh: %s', response.status_message);
				}
			} else {
				console.log('Error occurred, status code: %s', this.status);
			}
		};
		xhr.onerror = function () {
			console.log('Pushwoosh response status code to %s call in not 200', methodName)
		};
	} catch (e) {
		console.log('Exception while %s the device: %s', methodName, e);
	}
}