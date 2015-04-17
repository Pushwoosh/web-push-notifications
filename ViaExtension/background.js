// Returns a new notification ID used in the notification.
function getNotificationId() {
    var id = Math.floor(Math.random() * 9007199254740992) + 1;
    return id.toString();
}

function messageReceived(message) {
    // A message is an object with a data property that
    // consists of key-value pairs.

    console.log("Message received: " + JSON.stringify(message.data));

    // Pop up a notification to show the GCM message.
    // If you want use images from remote resource add it to manifest permissions
    // https://developer.chrome.com/apps/app_codelab8_webresources
    chrome.notifications.create(getNotificationId(), {
        title: message.data.header || message.data.body,
        iconUrl: message.data.i || 'logo.png',
        type: 'basic',
        message: message.data.body
    }, function(notificationId) {
        if (chrome.runtime.lastError) {
            // When the registration fails, handle the error and retry the registration later.
            // See error codes here https://developer.chrome.com/extensions/cloudMessaging#error_reference
            console.log("Fail to create the message: " + chrome.runtime.lastError.message);
            return;
        }
    });

    chrome.storage.local.set({
        messageHash: message.data.p,
        richPageOld: message.data.h,
        url: message.data.l
    });
}

var appWindow = null;

function createWindow() {
    chrome.app.window.create(
        "register.html",
        {
            width: 500,
            height: 400,
            frame: 'chrome',
            resizable: true
        },
        function(appWin) {
            appWindow = appWin;
            appWin.onClosed.addListener(function() {
                console.log('Window is closed');
                appWindow = null;
            });
        }
    );
}

function firstTimeRegistration() {
    createWindow();
}

function pushClickEvent() {
    pushwooshStatistics();
    chrome.storage.local.get(['url', 'richPageOld'], function(items)  {
        if (items.url) {
            window.open(items.url, '_newtab');
        }
        else if (items.richPageOld) {
            window.open('https://cp.pushwoosh.com/pages/' + items.richPageOld, '_newtab');
        }
        chrome.storage.local.remove(['url', 'richPageOld']);
    });
    if (appWindow != null) {
        console.log('Window is restored');
        appWindow.show();
    } else {
        console.log('Window is created');
        createWindow();
    }
}

// Set up a listener for GCM message event.
chrome.gcm.onMessage.addListener(messageReceived);

// Set up listeners to trigger the first time registration.
chrome.runtime.onInstalled.addListener(firstTimeRegistration);
chrome.runtime.onStartup.addListener(firstTimeRegistration);
// Add listener for send push-open statistics to Pushwoosh
chrome.notifications.onClicked.addListener(pushClickEvent);
