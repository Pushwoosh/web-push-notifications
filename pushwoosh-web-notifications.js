var PUSHWOOSH_SERVICE_WORKER_URL = '/service-worker.js';
var PUSHWOOSH_SAFARI_WEB_SITE_PUSH_ID = 'web.com.pushwoosh.websiteid';	//Enter your Safari website ID here

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
			"timezone": -(new Date).getTimezoneOffset() * 60, // offset in seconds
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
		var xhr = new XMLHttpRequest(),
		url = this.pushwooshUrl + methodName,
		params =
		{
			request: arguments
		};

		xhr.open('POST', url, true);
		xhr.setRequestHeader('Content-Type', 'text/plain;charset=UTF-8');
		xhr.send(JSON.stringify(params));
		xhr.onload = function ()
		{
			if (this.status == 200)
			{
				var response = JSON.parse(this.responseText);
				if (response.status_code == 200)
				{
					console.log('%s call to Pushwoosh has been successful', methodName);
				}
				else
				{
					console.log('Error occurred during the %s call to Pushwoosh: %s', response.status_message);
				}
			}
			else
			{
				console.log('Error occurred, status code: %s', this.status);
			}
		};

		xhr.onerror = function ()
		{
			console.log('Pushwoosh response status code to %s call in not 200', methodName)
		};
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


var PushwooshSafari = function()
{
	PushwooshBase.call(this);

    this.WEB_SITE_PUSH_ID = PUSHWOOSH_SAFARI_WEB_SITE_PUSH_ID;

	this.hwid = "";
	this.isFirstRegister = "isFirstRegister";

	try
	{
		var permissionData = window.safari.pushNotification.permission(this.WEB_SITE_PUSH_ID);
	    if(permissionData && permissionData.deviceToken)
	        this.hwid = permissionData.deviceToken.toLowerCase();
	}catch(e){}

	var self = this;
	window.addEventListener('load', function()
	{
	    self.sendPushStat();
	});
};

PushwooshSafari.prototype = Object.create(PushwooshBase.prototype);
PushwooshSafari.prototype.constructor = PushwooshSafari;

PushwooshSafari.prototype.subscribe = function()
{
    var permissionData = window.safari.pushNotification.permission(this.WEB_SITE_PUSH_ID);
    this.checkRemotePermission(permissionData);
};

PushwooshSafari.prototype.unsubscribe = function()
{
	this.pushwooshUnregisterDevice(this.hwid);
};

PushwooshSafari.prototype.checkRemotePermission = function(permissionData)
{
	//this function will be called as a callback and this pointer will be pointing to Window. Thanks, Safari.
	var thisO = pushwooshInstance;
    console.log(permissionData);

    if(permissionData && permissionData.deviceToken)
        thisO.hwid = permissionData.deviceToken.toLowerCase();

    if (permissionData.permission === 'default')
    {
	    try
	    {
		    localStorage.setItem(thisO.isFirstRegister, 'true');
	    }
	    catch (e)
	    {
		    console.log('Storage failed');
	    }
        console.log('This is a new web service URL and its validity is unknown.');
        window.safari.pushNotification.requestPermission(
            thisO.pushwooshUrl + 'safari',
            thisO.WEB_SITE_PUSH_ID,
            { application: thisO.APPLICATION_CODE },
            thisO.checkRemotePermission    // The callback function, it not called after Allow/Not Allow
        );
    }
    else if (permissionData.permission === 'denied')
    {
        console.log('The user said no.');
    }
    else if (permissionData.permission === 'granted')
    {
        console.log('The web service URL is a valid push provider, and the user said yes.');
	    console.log('You pushtoken is ' + permissionData.deviceToken.toLowerCase());
        // set system tags
        try
        {
            if (localStorage.getItem(thisO.isFirstRegister))
            {
                var tags =
                {
                    "Language": window.navigator.language || 'en',
                    "Device Model": thisO.getBrowserVersion(),
                    "Device Name": thisO.pushwooshGetDeviceName()
                };

                thisO.pushwooshSetTags(thisO.hwid, tags);
            }

            localStorage.removeItem(thisO.isFirstRegister);
        } catch (e)
        {
            console.log("Storage failed");
        }
    }
};

PushwooshSafari.prototype.setTags = function (tags)
{
	if(this.hwid == "")
		return;
	
	this.pushwooshSetTags(this.hwid, tags);
};

// send to Pushwoosh push open statistics
PushwooshSafari.prototype.sendPushStat = function()
{
    //this method is Safari only
    if (navigator.userAgent.indexOf('Safari') <= -1)
        return;

    //make sure push notifications are supported
    if (!('safari' in window) || !('pushNotification' in window.safari))
        return;

    try
    {
        var hashReg = /#P(.*)/;
        var hash = decodeURIComponent(document.location.hash);

        if (!hashReg.test(hash) || !this.hwid)
            return;

        this.doPushwooshApiMethod('pushStat',
        {
            application: this.APPLICATION_CODE,
            hwid: this.hwid,
            hash: hashReg.exec(hash)[1]
        });
    } catch (e) {}
};



function pwIsSafariBrowser()
{
	if(window && window.safari)
		return true;

	if (navigator.userAgent.indexOf('Safari') > -1)
		return true;

	return false;
}

function pwCanUseServiceWorkers()
{
	if (!navigator || !navigator.serviceWorker)
		return false;

	return true;
}

var pushwooshInstance = null;

if(pwCanUseServiceWorkers())
{
	pushwooshInstance = new PushwooshChrome();
}
else if (pwIsSafariBrowser())
{
	pushwooshInstance = new PushwooshSafari();
}

function pushwooshSubscribe ()
{
	if(!pushwooshInstance)
		return;

	pushwooshInstance.subscribe();
}

function pushwooshUnsubscribe ()
{
	if(!pushwooshInstance)
		return;

	pushwooshInstance.unsubscribe();
}

function pushwooshSetTags(tags)
{
	if(!pushwooshInstance)
		return;

	pushwooshInstance.setTags(tags);
}

// Try to subscribe for a push notification when page is loaded
//window.addEventListener('load', function () {
//	pushwooshSubscribe();
//});
