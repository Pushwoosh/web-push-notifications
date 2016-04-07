var PUSHWOOSH_SERVICE_WORKER_URL = '/service-worker.js';
var PUSHWOOSH_DEFAULT_IMAGE = 'https://cp.pushwoosh.com/img/logo-medium.png';
var PUSHWOOSH_DEFAULT_TITLE = 'Title';

//this is a copy of a PushwooshBase in pushwoosh-web-notifications.js, just using fetch instead of xhr
var PushwooshBase = function()
{
	this.APPLICATION_CODE = "XXXXX-XXXXX"; // Your Application Code from Pushwoosh
	this.pushwooshUrl = "https://cp.pushwoosh.com/json/1.3/";
};

PushwooshBase.prototype.getBrowserVersion = function ()
{
	var ua = navigator.userAgent, tem,
		M = ua.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || [];

	if (/trident/i.test(M[1]))
	{
		tem = /\brv[ :]+(\d+)/g.exec(ua) || [];
		return 'IE ' + (tem[1] || '');
	}

	if (M[1] === 'Chrome')
	{
		tem = ua.match(/\bOPR\/(\d+)/);
		if (tem != null) return 'Opera ' + tem[1];
	}

	M = M[2] ? [M[1], M[2]] : [navigator.appName, navigator.appVersion, '-?'];
	if ((tem = ua.match(/version\/([.\d]+)/i)) != null)
		M.splice(1, 1, tem[1]);

	return M.join(' ');
};

PushwooshBase.prototype.pushwooshGetDeviceName = function ()
{
	if (navigator.userAgent.match(/Android/i)
		|| navigator.userAgent.match(/webOS/i)
		|| navigator.userAgent.match(/iPhone/i)
		|| navigator.userAgent.match(/iPad/i)
		|| navigator.userAgent.match(/iPod/i)
		|| navigator.userAgent.match(/BlackBerry/i)
		|| navigator.userAgent.match(/Windows Phone/i)
	) {
		return 'Phone';
	}
	else {
		return 'PC';
	}
};

/**
 * Call Pushwoosh registerDevice API method
 * For more information see Pushwoosh API guide http://docs.pushwoosh.com/docs/createmessage
 * @param {string} pushToken
 * @param {string} hwid
 * @param {string} encryptionKey
 */
PushwooshBase.prototype.pushwooshRegisterDevice = function (pushToken, hwid, encryptionKey)
{
	this.doPushwooshApiMethod('registerDevice',
	{
			"application": this.APPLICATION_CODE,
			"push_token": pushToken,
			"language": window.navigator.language || 'en',  // Language locale of the device, must be a lowercase two-letter code according to the ISO-639-1 standard
			"hwid": hwid,
			"timezone": (new Date).getTimezoneOffset(), // offset in seconds
			"device_model": this.getBrowserVersion(),
			"device_name": this.pushwooshGetDeviceName(),
			"device_type": this.pushwooshGetBrowserType(),
			"public_key": encryptionKey
		}
	);
};

/**
 * Determine device type
 * @returns {number}
 */
PushwooshBase.prototype.pushwooshGetBrowserType = function ()
{
	var deviceType = 11; // chrome

	var isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
	if (isFirefox)
	{
		deviceType = 12;
	}

	return deviceType;
};

/**
 * Call Pushwoosh unregisterDevice API method
 * @param {string} hwid
 */
PushwooshBase.prototype.pushwooshUnregisterDevice = function (hwid)
{
	this.doPushwooshApiMethod('unregisterDevice',
	{
		application: this.APPLICATION_CODE,
		hwid: hwid
	});
};

/**
 * Call Pushwoosh setTags API method
 * @param {string} hwid
 * @param {Object} tags
 */
PushwooshBase.prototype.pushwooshSetTags = function (hwid, tags)
{
	this.doPushwooshApiMethod('setTags',
	{
		application: this.APPLICATION_CODE,
		hwid: hwid,
		tags: tags
	});
};

/**
 * Call Pushwoosh API method
 * @param {string} methodName
 * @param {Object} arguments
 */
PushwooshBase.prototype.doPushwooshApiMethod = function (methodName, arguments)
{
	console.log('Performing %s call to Pushwoosh with arguments: %s', methodName, JSON.stringify(arguments));
	try
	{
		var url = this.pushwooshUrl + methodName;
		var params =
		{
			request: arguments
		};

		return fetch(url,
		{
			method: 'post',
			headers: {
				"Content-Type": "text/plain;charset=UTF-8"
			},
			body: JSON.stringify(params)
		});
	} catch (e)
	{
		console.log('Exception while %s the device: %s', methodName, e);
	}
};

var PushwooshChrome = function()
{
	PushwooshBase.call(this);

	this.SERVICE_WORKER_URL = PUSHWOOSH_SERVICE_WORKER_URL;
	this.hwid = "";
};

PushwooshChrome.prototype = Object.create(PushwooshBase.prototype);
PushwooshChrome.prototype.constructor = PushwooshChrome;

PushwooshChrome.prototype.registerServiceWorker = function(serviceWorkerRegistration)
{
	//NOTE: this pointer in this function is actually points to Window. We assume the window has pushwooshInstance var. Otherwise what are we doing here?
	var self = pushwooshInstance;

	// Are Notifications supported in the service worker?
	if (!('showNotification' in ServiceWorkerRegistration.prototype)) {
		console.log('Notifications aren\'t supported.');
		return;
	}

	// Check the current Notification permission.
	// If its denied, it's a permanent block until the
	// user changes the permission
	if (Notification.permission === 'denied') {
		console.log('The user has blocked notifications.');
		return;
	}

	// Check if push messaging is supported
	if (!('PushManager' in window)) {
		console.log('Push messaging isn\'t supported.');
		return;
	}

	serviceWorkerRegistration.pushManager.getSubscription().
	then(function (subscription)
	{
		// Enable any UI which subscribes / unsubscribes from push messages.
		if (!subscription)
		{
			// subscribe for push notifications
			serviceWorkerRegistration.pushManager.subscribe(
			{
				name: 'push',
				userVisibleOnly: true
			}).
			then(function (subscription)
			{
				// The subscription was successful
				pushToken = self.getPushToken(subscription);
				self.hwid = self.generateHwid(pushToken);
				var encryptionKey = self.getEncryptionKey(subscription);
				self.pushwooshRegisterDevice(pushToken, self.hwid, encryptionKey);
			}).catch(function (e)
			{
				if (Notification.permission === 'denied')
				{
					// The user denied the notification permission which
					// means we failed to subscribe and the user will need
					// to manually change the notification permission to
					// subscribe to push messages
					console.log('Permission for Notifications was denied');
				} else
				{
					// A problem occurred with the subscription; common reasons
					// include network errors, and lacking gcm_sender_id and/or
					// gcm_user_visible_only in the manifest.
					console.log('Unable to subscribe to push.', e);
				}
			});

			return;
		}

		// Keep your server in sync with the latest hwid/pushToken/encryptionKey
		var pushToken = self.getPushToken(subscription);
		self.hwid = self.generateHwid(pushToken);
		var encryptionKey = self.getEncryptionKey(subscription);
		// Set your UI to show they have subscribed for push messages. This line of code below should be disabled in production.
        // self.pushwooshRegisterDevice(pushToken, self.hwid, encryptionKey);

		console.log("Ready to get pushes. Push token is " + pushToken + "; Encryption Key is " + encryptionKey);
	}).catch(function (err)
	{
		console.log('Error during getSubscription()', err);
	});
};

PushwooshChrome.prototype.subscribe = function() 
{
	// Check that service workers are supported, if so, progressively
	// enhance and add push messaging support, otherwise continue without it.
	if (!('serviceWorker' in navigator))
	{
		console.log('Service workers aren\'t supported in this browser.');
		return;
	}

	navigator.serviceWorker.register(this.SERVICE_WORKER_URL).
	then( this.registerServiceWorker ).
	catch(function (err)
	{
		console.log('Error while service worker registration', err);
	});
};

PushwooshChrome.prototype.unsubscribe = function ()
{
	var self = this;
	navigator.serviceWorker.ready.then(function (serviceWorkerRegistration)
	{
		// To unsubscribe from push messaging, you need get the
		// subscription object, which you can call unsubscribe() on.
		serviceWorkerRegistration.pushManager.getSubscription().
		then(function (pushSubscription)
		{
			// Check we have a subscription to unsubscribe
			if (!pushSubscription)
			{
				// No subscription object, so set the state
				// to allow the user to subscribe to push
				return;
			}

			var pushToken = self.getPushToken(pushSubscription);
			// We have a subscription, so call unsubscribe on it
			pushSubscription.unsubscribe().
			then(function (successful)
			{
				self.pushwooshUnregisterDevice(self.generateHwid(pushToken));
			}).
			catch(function (e)
			{
				// We failed to unsubscribe, this can lead to
				// an unusual state, so may be best to remove
				// the users data from your data store and
				// inform the user that you have done so
				console.log('Unsubscription error: ', e);
			});
		}).catch(function (e)
		{
			console.error('Error thrown while unsubscribing from push messaging.', e);
		});
	});
};

PushwooshChrome.prototype.setTags = function (tags)
{
	var self = this;
	navigator.serviceWorker.ready.then(function (serviceWorkerRegistration)
	{
		serviceWorkerRegistration.pushManager.getSubscription().
		then(function (pushSubscription)
		{
			if (!pushSubscription)
			{
				return;
			}

			var pushToken = self.getPushToken(pushSubscription);
			self.hwid = self.generateHwid(pushToken);
			self.pushwooshSetTags(self.hwid, tags);
		}).catch(function (e)
		{
			console.error('Error thrown while setTags from push messaging.', e);
		});
	});
};

PushwooshChrome.prototype.createUUID = function (pushToken)
{
	var s = [];
	var hexDigits = "0123456789abcdef";
	for (var i = 0; i < 32; i++)
	{
		var charCode = "0";
		if(pushToken.length - i - 1 >= 0)
		{
			charCode = pushToken.charCodeAt(pushToken.length - i - 1);
		}

		s[i] = hexDigits.substr(charCode % hexDigits.length, 1);
	}
	return s.join("");
};

PushwooshChrome.prototype.generateHwid = function (pushToken)
{
	var hwid = this.APPLICATION_CODE + '_' + this.createUUID(pushToken);
	return hwid;
};

PushwooshChrome.prototype.getEncryptionKey = function (pushSubscription)
{
	var rawKey = pushSubscription.getKey ? pushSubscription.getKey('p256dh') : '';
	var key = rawKey ? btoa(String.fromCharCode.apply(null, new Uint8Array(rawKey))) : '';
	return key;
};

PushwooshChrome.prototype.getPushToken = function (pushSubscription)
{
	var pushToken = '';
	if (pushSubscription.subscriptionId)
	{
		pushToken = pushSubscription.subscriptionId;
		console.log("Chrome 42, 43, 44: " + pushToken);
	}
	else if (this.pushwooshGetBrowserType() === 12)
	{
		pushToken = pushSubscription.endpoint;
		console.log("Firefox: " + pushToken);
	}
	else
	{
		pushToken = pushSubscription.endpoint.split('/').pop();
		console.log("Chrome 45+: " + pushToken);
	}
	
	return pushToken;
};


var PWServiceWorker = function()
{
	PushwooshBase.call(this);

	this.hwid = "";

	this.pushDefaultImage = PUSHWOOSH_DEFAULT_IMAGE;
	this.pushDefaultTitle = PUSHWOOSH_DEFAULT_TITLE;
	this.pushDefaultUrl = '/';
	this.DEBUG_MODE = false;
	this.deviceType = this.pushwooshGetBrowserType();

	var thisO = this;

	try
	{
		self.registration.pushManager.getSubscription().
		then( function(subscription)
		{
			if (subscription)
			{
				thisO.hwid = thisO.generateHwid(thisO.getPushToken(subscription));
			}
		});
	}
	catch(e) {}
};

PWServiceWorker.prototype = Object.create(PushwooshChrome.prototype);
PWServiceWorker.prototype.constructor = PWServiceWorker;

PWServiceWorker.prototype.closeNotifications = function ()
{
	self.registration.getNotifications().
	then(function (notifications)
	{
		for (var i = 0; i < notifications.length; ++i)
		{
			notifications[i].close();
		}
	});
};

PWServiceWorker.prototype.pushReceivedWithData = function (event)
{
	var thisO = pwServiceWorker;

	if (!event || !event.data)
	{
		console.log("pushReceivedWithData: no data available!");
		return null;
	}

	var content = event.data.text();
	content = JSON.parse(content);
	var title = content['header'] || thisO.pushDefaultTitle;
	var message = content['body'];
	var icon = content['i'] || thisO.pushDefaultImage;
	var messageHash = content['p'];
	var url = content['l'] || thisO.pushDefaultUrl;

	var tag =
	{
		"url": url,
		"messageHash": messageHash
	};

	return self.registration.showNotification(title,
	{
		body: message,
		icon: icon,
		tag: JSON.stringify(tag)
	});
};

PWServiceWorker.prototype.createPushFromResponse = function (response)
{
	var thisO = pwServiceWorker;

	if (response.status !== 200)
	{
		// Either show a message to the user explaining the error
		// or enter a generic message and handle the
		// onnotificationclick event to direct the user to a web page
		console.log('Looks like there was a problem. Status Code: ' + response.status);
		throw new Error();
	}

	// Examine the text in the response
	return response.json().then(function (data)
	{
		if (!data.response.notification)
		{
			console.error('The API returned an error.', data.error);
			throw new Error();
		}

		var notification = data.response.notification;
		console.log(notification);

		var title = notification.chromeTitle || thisO.pushDefaultTitle;
		var message = notification.content;
		var icon = notification.chromeIcon || thisO.pushDefaultImage;
		var messageHash = notification.messageHash;
		var url = notification.url || thisO.pushDefaultUrl;

		var tag = {
			"url": url,
			"messageHash": messageHash
		};

		return self.registration.showNotification(title,
		{
			body: message,
			icon: icon,
			tag: JSON.stringify(tag)
		});
	});
};

PWServiceWorker.prototype.fetchLastPushMessage = function (subscription)
{
	var thisO = pwServiceWorker;

	if (subscription)
	{
		thisO.hwid = thisO.generateHwid(thisO.getPushToken(subscription));
	}

	console.log("Try get last message with hwid: " + thisO.hwid);

	return thisO.doPushwooshApiMethod('getLastMessage',
	{
		application: thisO.APPLICATION_CODE,
		hwid: thisO.hwid,
		device_type: thisO.deviceType
	});
};

PWServiceWorker.prototype.pushReceived = function (event)
{
	var thisO = pwServiceWorker;

	// Since there is no payload data with the first version
	// of push messages, we'll grab some data from
	// an API and use it to populate a notification
	console.info("Recv'd a push message: ", JSON.stringify(event));
	if (event.data)
	{
		console.info("event with data!");

		thisO.pushReceivedWithData(event);
		return;
	}

	event.waitUntil(
		self.registration.pushManager.getSubscription().
		then( thisO.fetchLastPushMessage ).
		then( thisO.createPushFromResponse ).
		catch(function (err)
		{
			console.error('Unable to retrieve data', err);

			if (thisO.DEBUG_MODE)
			{
				var title = 'An error occurred';
				var message = 'We were unable to get the information for this push message';
				var notificationTag = 'notification-error';
				return self.registration.showNotification(title,
				{
					body: message,
					tag: notificationTag
				});
			}
		})
	)
};

PWServiceWorker.prototype.sendPushStat = function(subscription, tag)
{
	var thisO = pwServiceWorker;

	if (subscription)
	{
		thisO.hwid = thisO.generateHwid(thisO.getPushToken(subscription));
	}

	console.info("sending stats: " + thisO.hwid);

	return thisO.doPushwooshApiMethod('pushStat',
	{
		application: thisO.APPLICATION_CODE,
		hwid: thisO.hwid,
		hash: tag.messageHash
	});
};

PWServiceWorker.prototype.notificationClicked = function (event)
{
	var thisO = pwServiceWorker;

	var tag = event.notification.tag;
	tag = JSON.parse(tag);
	console.log(event);
	console.log("Push open hwid = " + thisO.hwid + ". Tag = " + event.notification.tag);
	event.waitUntil(
		self.registration.pushManager.getSubscription().
		then(function (subscription)
		{
			return thisO.sendPushStat(subscription, tag);
		}).
		then(function (response)
		{
			console.log(response);
		}));

	// Android doesn't close the notification when you click on it
	// See: http://crbug.com/463146
	event.notification.close();

	return clients.openWindow(tag.url);
};

var pwServiceWorker = new PWServiceWorker();

self.addEventListener('push', pwServiceWorker.pushReceived);
self.addEventListener('notificationclick', pwServiceWorker.notificationClicked);

// refresh caches
self.addEventListener('activate', function (event)
{
	event.waitUntil(
		caches.keys().then(function (cacheNames)
		{
			return Promise.all(
				cacheNames.map(function (cacheName)
				{
					return caches.delete(cacheName);
				})
			);
		})
	);
});
