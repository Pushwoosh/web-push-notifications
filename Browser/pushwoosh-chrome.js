var APPLICATION_CODE = "XXXXX-XXXXX"; // Your Application Code from Pushwoosh
var SERVICE_WORKER_URL = '/service-worker.js';
var pushwooshUrl = "https://cp.pushwoosh.com/json/1.3/";
var hwid = "";
var isPushEnabled = false;

window.addEventListener('load', function() {
    // Check that service workers are supported, if so, progressively
    // enhance and add push messaging support, otherwise continue without it.
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register(SERVICE_WORKER_URL)
            .then(function(serviceWorkerRegistration) {
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
                    .then(function(subscription) {
                        // Enable any UI which subscribes / unsubscribes from
                        // push messages.
                        if (!subscription) {
                            // subscribe for push notifications
                            serviceWorkerRegistration.pushManager.subscribe()
                                .then(function(subscription) {
                                    // The subscription was successful
                                    isPushEnabled = true;
                                    console.log(subscription);
                                    pushToken = subscription.subscriptionId;
                                    hwid = generateHwid(pushToken);
                                    pushwooshRegisterDevice(pushToken, hwid);
                                })
                                .catch(function(e) {
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

                        // Keep your server in sync with the latest subscriptionId
                        var pushToken = subscription.subscriptionId;
                        hwid = generateHwid(pushToken);
                        if (navigator.serviceWorker.controller) {
                            navigator.serviceWorker.controller.postMessage({'hwid': hwid, 'applicationCode': APPLICATION_CODE, 'pushwooshUrl': pushwooshUrl});
                        }

                        // Set your UI to show they have subscribed for
                        // push messages
                        isPushEnabled = true;
                        console.log("Ready to get pushes. Push token is " + pushToken);
                    })
                    .catch(function(err) {
                        console.warn('Error during getSubscription()', err);
                    });
            })
            .catch(function(err) {
                console.log('Error while service worker registration', err);
            });
    } else {
        console.warn('Service workers aren\'t supported in this browser.');
    }
});

function subscribe() {
    console.log("Try to subscribe for push notifications");
    navigator.serviceWorker.ready.then(function(serviceWorkerRegistration) {
        serviceWorkerRegistration.pushManager.subscribe()
            .then(function(subscription) {
                // The subscription was successful
                isPushEnabled = true;
                console.log(subscription);
                pushToken = subscription.subscriptionId;
                hwid = generateHwid(pushToken);
                pushwooshRegisterDevice(pushToken, hwid);
            })
            .catch(function(e) {
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
    });
}



function unsubscribe() {
    navigator.serviceWorker.ready.then(function(serviceWorkerRegistration) {
        // To unsubscribe from push messaging, you need get the
        // subscription object, which you can call unsubscribe() on.
        serviceWorkerRegistration.pushManager.getSubscription().then(
            function(pushSubscription) {
                // Check we have a subscription to unsubscribe
                if (!pushSubscription) {
                    // No subscription object, so set the state
                    // to allow the user to subscribe to push
                    isPushEnabled = false;
                    return;
                }

                var pushToken = pushSubscription.subscriptionId;

                // We have a subscription, so call unsubscribe on it
                pushSubscription.unsubscribe().then(function(successful) {
                    isPushEnabled = false;
                    pushwooshUnregisterDevice(generateHwid(pushToken));
                }).catch(function(e) {
                    // We failed to unsubscribe, this can lead to
                    // an unusual state, so may be best to remove
                    // the users data from your data store and
                    // inform the user that you have done so

                    console.log('Unsubscription error: ', e);
                });
            }).catch(function(e) {
                console.error('Error thrown while unsubscribing from push messaging.', e);
            });
    });
}

// For more information see Pushwoosh API guide https://www.pushwoosh.com/programming-push-notification/pushwoosh-push-notification-remote-api/

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

// Registers device for the application
function pushwooshRegisterDevice(pushToken, hwid){
    console.log('Trying to send registerDevice call to Pushwoosh with pushToken=' + pushToken + ' hwid=' + hwid);
    try {
        var xhr = new XMLHttpRequest(),
            url = pushwooshUrl + 'registerDevice',
            params = {
                "request":{
                    "application": APPLICATION_CODE,
                    "push_token": pushToken,
                    "language": window.navigator.language || 'en',  // optional
                    "hwid": hwid,
                    "timezone": (new Date).getTimezoneOffset(), // offset in seconds
                    "device_model": get_browser_version(),
                    "device_type": 11
                }
            };

        xhr.open('POST', url, true);
        xhr.setRequestHeader('Content-Type', 'text/plain;charset=UTF-8');
        xhr.send(JSON.stringify(params));
        xhr.onload = function(){
            if(this.status == 200){
                var response = JSON.parse(this.responseText);
                if (response.status_code == 200) {
                    console.log('registerDevice call to Pushwoosh has been successful');
                }
                else {
                    console.log('Error occurred during the registerDevice call to Pushwoosh: ' + response.status_message);
                }
            }else{
                console.log('Error occurred, status code:' + this.status);
            }
        };
        xhr.onerror = function(){
            console.log('Pushwoosh response status code to registerDevice call is not 200')
        };
    } catch(e) {
        console.log('Exception while registering the device with Pushwoosh: ' + e);
        return;
    }
}

// Remove device from the application
function pushwooshUnregisterDevice(hwid) {
    console.log('Performing unregisterDeivce call to Pushwoosh with hwid=' + hwid);
    try {
        var xhr = new XMLHttpRequest(),
            url = pushwooshUrl + "unregisterDevice",
            params = {
                request: {
                    application: APPLICATION_CODE,
                    hwid: hwid
                }
            };
        xhr.open('POST', url, true);
        xhr.setRequestHeader('Content-Type', 'text/plain;charset=UTF-8');
        xhr.send(JSON.stringify(params));
        xhr.onload = function(){
            if(this.status == 200){
                var response = JSON.parse(this.responseText);
                if (response.status_code == 200) {
                    console.log('unregisterDevice call to Pushwoosh has been successful');
                }
                else {
                    console.log('Error occurred during the unregisterDevice call to Pushwoosh:: ' + response.status_message);
                }
            }else{
                console.log('Error occurred, status code::' + this.status);
            }
        };
        xhr.onerror = function(){
            console.log('Pushwoosh response status code to unregisterDevice call in not 200')
        };
    } catch(e) {
        console.log('Exception while unregistering the device: ' + e);
        return;
    }
}


function get_browser_version() {
    var ua = navigator.userAgent, tem,
        M = ua.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || [];
    if (/trident/i.test(M[1])) {
        tem =  /\brv[ :]+(\d+)/g.exec(ua) || [];
        return 'IE '+(tem[1] || '');
    }
    if (M[1] === 'Chrome') {
        tem = ua.match(/\bOPR\/(\d+)/)
        if(tem!= null) return 'Opera '+tem[1];
    }
    M = M[2] ? [M[1], M[2]]: [navigator.appName, navigator.appVersion, '-?'];
    if((tem= ua.match(/version\/([.\d]+)/i))!= null)
        M.splice(1, 1, tem[1]);
    return M.join(' ');
}
