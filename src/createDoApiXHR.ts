import Logger, {logAndRejectError} from './logger';

export default function createDoApiXHR(pushwooshUrl: string) {
  return function doApiXHR(methodName: string, request: any) {
    return new Promise((resolve, reject) => {
      try {
        const url = `${pushwooshUrl}${methodName}`;
        const params = {request};

        const xhr = new XMLHttpRequest();
        xhr.open('POST', url, true);
        xhr.setRequestHeader('Content-Type', 'text/plain;charset=UTF-8');
        xhr.onload = function xhrOnLoad() {
          if (xhr.status == 200) {
            try {
              const response = JSON.parse(xhr.responseText);
              if (response.status_code == 200) {
                Logger.write('apirequest', `${methodName} call with arguments: ${JSON.stringify(request)} to Pushwoosh has been successful. Result: ${JSON.stringify(response.response)}`, 'createDoApiXHR');
                resolve(response.response);
              }
              else {
                logAndRejectError(`Error occurred during the ${methodName} call to Pushwoosh: ${response.status_message}`, reject);
              }
            } catch (e) {
              logAndRejectError(`Error parse responce: ${e}`, reject);
            }
          }
          else {
            logAndRejectError(`Error occurred, status code: ${xhr.status}`, reject);
          }
        };
        xhr.onerror = function xhrOnError(e) {
          logAndRejectError(`Pushwoosh response to ${methodName} call in not ok: ${e}`, reject);
        };
        xhr.send(JSON.stringify(params));
      }
      catch (e) {
        logAndRejectError(`Exception while ${methodName} the device: ${e}`, reject);
      }
    });
  };
}
