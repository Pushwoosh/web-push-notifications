import Logger, {logAndRejectError} from './logger';
import {getPushwooshUrl} from "./functions";

export default function createDoApiFetch(applicationCode: string, pushwooshApiUrl?: string) {
  return function doApiFetch(methodName: string, request: any) {
    return new Promise((resolve, reject) => {
      getPushwooshUrl(applicationCode, false, pushwooshApiUrl).then(pushwooshUrl => {
        try {
          const url = `${pushwooshUrl}${methodName}`;
          const params = {request};

          fetch(url, {
            method: 'post',
            headers: {'Content-Type': 'text/plain;charset=UTF-8'},
            body: JSON.stringify(params)
          }).then((response) => {
            if (!response.ok) {
              logAndRejectError(response.statusText || 'response not ok', reject);
            }
            else {
              response.json().then((json: any) => {
                if (json.status_code != 200) {
                  logAndRejectError(`Error occurred during the ${methodName} call to Pushwoosh: ${json.status_message}`, reject);
                }
                else {
                  Logger.write('apirequest', `${methodName} call with arguments: ${JSON.stringify(request)} to Pushwoosh has been successful. Result: ${JSON.stringify(json.response)}`, 'createDoApiFetch');
                  resolve(json.response);
                }
              });
            }
          });
        }
        catch (e) {
          logAndRejectError(`Exception while ${methodName} the device: ${e}`, reject);
        }
      });
    });
  };
}
