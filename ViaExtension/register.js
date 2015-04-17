var registrationId = "";

function setStatus(status) {
    document.getElementById("status").value = status;
}

function createUUID() {
    var s = [];
    var hexDigits = "0123456789abcdef";
    for (var i = 0; i < 32; i++) {
        s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
    }
    return s.join("");
}

function generateHwid() {
    var hwid = APPLICATION_CODE + '_' + createUUID();
    console.log("HWID generated " + hwid);
    return hwid;
}

function register() {
    chrome.storage.local.get("registered", function(result) {
        // If already registered, bail out.
        if (result["registered"]) {
            setStatus("You are already registered. Unregister first");
            document.getElementById("register").disabled = true;
            document.getElementById("unregister").disabled = false;
            return;
        }
        var senderId = document.getElementById("senderId").value;
        chrome.gcm.register([senderId], registerCallback);

        setStatus("Registering ...");

        // Prevent register button from being click again before the registration finishes.
        document.getElementById("register").disabled = true;
        document.getElementById("unregister").disabled = true;
    });
}

function unregister() {
    chrome.gcm.unregister(unregisterCallback);
    setStatus("Unregistering ...");

    document.getElementById("register").disabled = true;
    document.getElementById("unregister").disabled = true;
}

function registerCallback(pushToken) {
    registrationId = pushToken;
    document.getElementById("register").disabled = true;
    document.getElementById("unregister").disabled = false;

    if (chrome.runtime.lastError) {
        // When the registration fails, handle the error and retry the
        // registration later.
        setStatus("Registration failed: " + chrome.runtime.lastError.message);
        return;
    }

    setStatus("Registration has been successful. Your push token is  " + pushToken);

    // Mark that the first-time registration is done and generate hwid.
    chrome.storage.local.get('hwid', function(items) {
        console.log(items.hwid);
       if (items.hwid) {
           console.log('hwid exists: ' + items.hwid);
           pushwooshRegisterDevice(pushToken);
       } else {
           var hwid = generateHwid();
           console.log('My hwid is: ' + hwid);
           chrome.storage.local.set({hwid: hwid}, function() {
               pushwooshRegisterDevice(pushToken);
           });
       }
    });
    chrome.storage.local.set({registered: true});
}

function unregisterCallback() {
    document.getElementById("register").disabled = false;
    document.getElementById("unregister").disabled = true;

    if (chrome.runtime.lastError) {
        setStatus("Unregistration failed: " + chrome.runtime.lastError.message);
        return;
    }

    setStatus("Unregistration has been successful");
    // Mark that the first-time registration is not done.
    chrome.storage.local.set({registered: false});

    pushwooshUnregisterDevice();
}

window.onload = function() {
    document.getElementById("unregister").disabled = true;
    document.getElementById("register").onclick = register;
    document.getElementById("unregister").onclick = unregister;
    setStatus("You have not registered yet. Please provider sender ID and register.");
};
