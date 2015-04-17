/*
    For more information see Pushwoosh API guide https://www.pushwoosh.com/programming-push-notification/pushwoosh-push-notification-remote-api/
*/

var APPLICATION_CODE = "4FC89B6D14A655.46488481"; // You Application Code from Pushwoosh
var pushwooshUrl = "https://cp.pushwoosh.com/json/1.3/";

/*
 Registers device for the application
*/
function pushwooshRegisterDevice(pushToken){
    console.log('Trying to send registerDevice call to Pushwoosh');
    chrome.storage.local.get('hwid', function(items)  {
        try {
            var xhr = new XMLHttpRequest(),
                url = pushwooshUrl + 'registerDevice',
                params = {
                    "request":{
                        "application": APPLICATION_CODE,
                        "push_token": pushToken,
                        "language": window.navigator.language || 'en',  // optional
                        "hwid": items.hwid,
                        "timezone": (new Date).getTimezoneOffset(), // offset in seconds
                        "device_type": 11
                    }
                };

            xhr.open('POST', url, true);
            xhr.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
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
    });
}

/*
 Remove device from the application
*/
function pushwooshUnregisterDevice() {
    console.log('Performing unregisterDeivce call to Pushwoosh');
    chrome.storage.local.get('hwid', function(items)  {
        try {
            var xhr = new XMLHttpRequest(),
                url = pushwooshUrl + "unregisterDevice",
                params = {
                    request: {
                        application: APPLICATION_CODE,
                        hwid: items.hwid
                    }
                };
            xhr.open('POST', url, true);
            xhr.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
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
    });
}
/*
 Register push open event
*/
function pushwooshStatistics() {
    console.log('Sending push open statistics to Pushwoosh');
    chrome.storage.local.get(['hwid', 'messageHash'], function(items)  {
        try {
            var xhr = new XMLHttpRequest(),
                url = pushwooshUrl + 'pushStat',
                params = {
                    request:{
                        application: APPLICATION_CODE,
                        hwid: items.hwid,
                        hash: items.messageHash
                    }
                };

            xhr.open('POST', url, true);
            xhr.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
            xhr.send(JSON.stringify(params));
            xhr.onload = function(){
                if(this.status == 200){
                    var response = JSON.parse(this.responseText);
                    if (response.status_code == 200) {
                        console.log('Push open stats were successfully sent to Pushwoosh');
                    }
                    else {
                        console.log('Error occurred while sending Push Open stats to Pushwoosh: ' + response.status_message);
                    }
                }else{
                    console.log('Error occurred, status code::' + this.status);
                }
            };
            xhr.onerror = function(){
                console.log('Pushwoosh response status code to pushStat call in not 200')
            };
        } catch(e) {
            console.log('Exception while sending Push Open stats to Pushwoosh: ' + e);
            return;
        }
    });
}

/*
 Set tags values for device.
*/
function pushwooshSetTags() {
    console.log('Sending set tags to Pushwoosh');
    chrome.storage.local.get(['hwid'], function(items)  {
        try {
            var xhr = new XMLHttpRequest(),
                url = pushwooshUrl + 'setTags',
                params = {
                    request:{
                        application: APPLICATION_CODE,
                        hwid: items.hwid,
                        tags: {
                            "TagName1": "TagValue1",
                            "TagName2": "TagValue2"
                        }
                    }
                };

            xhr.open('POST', url, true);
            xhr.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
            xhr.send(JSON.stringify(params));
            xhr.onload = function(){
                if(this.status == 200){
                    var response = JSON.parse(this.responseText);
                    if (response.status_code == 200) {
                        console.log('Set tags method were successfully sent to Pushwoosh');
                    }
                    else {
                        console.log('Error occurred while sending setTags to Pushwoosh: ' + response.status_message);
                    }
                }else{
                    console.log('Error occurred, status code::' + this.status);
                }
            };
            xhr.onerror = function(){
                console.log('Pushwoosh response status code to pushStat call in not 200')
            };
        } catch(e) {
            console.log('Exception while sending setTags to Pushwoosh: ' + e);
            return;
        }
    });
}
