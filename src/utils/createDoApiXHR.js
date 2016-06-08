import PushwooshError from '../classes/PushwooshError';

export default function createDoApiXHR(pushwooshUrl, logger) {
  return function doApiXHR(methodName, request) {
    logger.debug(`Performing ${methodName} call to Pushwoosh with arguments: ${JSON.stringify(request)}`);
    return new Promise((resolve, reject) => {
      try {
        const xhr = new XMLHttpRequest();
        const url = pushwooshUrl + methodName;
        const params = {request};

        xhr.open('POST', url, true);
        xhr.setRequestHeader('Content-Type', 'text/plain;charset=UTF-8');
        xhr.onload = function xhrOnLoad() {
          if (this.status == 200) { // eslint-disable-line eqeqeq
            const response = JSON.parse(this.responseText);
            if (response.status_code == 200) { // eslint-disable-line eqeqeq
              logger.debug(`${methodName} call to Pushwoosh has been successful`);
              resolve(response.response);
            }
            else {
              const logText = new PushwooshError(`Error occurred during the ${methodName} call to Pushwoosh: ${response.status_message}`);
              logger.error(logText);
              reject(logText);
            }
          }
          else {
            const logText = new PushwooshError(`Error occurred, status code: ${this.status}`);
            logger.error(logText);
            reject(logText);
          }
        };
        xhr.onerror = function xhrOnError(e) {
          const logText = new PushwooshError(`Pushwoosh response to ${methodName} call in not ok: ${e}`);
          logger.error(logText);
          reject(logText);
        };
        xhr.send(JSON.stringify(params));
      }
      catch (e) {
        const logText = new PushwooshError(`Exception while ${methodName} the device: ${e}`);
        logger.error(logText);
        reject(logText);
      }
    });
  };
}
