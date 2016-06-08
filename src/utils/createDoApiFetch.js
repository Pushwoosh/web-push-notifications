import PushwooshError from '../classes/PushwooshError';

export default function createDoApiFetch(pushwooshUrl, logger) {
  return function doApiFetch(methodName, request) {
    logger.debug(`Performing ${methodName} call to Pushwoosh with arguments: ${JSON.stringify(request)}`);
    const url = pushwooshUrl + methodName;
    const params = {request};

    return fetch(url, {
      method: 'post',
      headers: {
        'Content-Type': 'text/plain;charset=UTF-8'
      },
      body: JSON.stringify(params)
    }).then(response => {
      if (!response.ok) {
        const logText = new PushwooshError(response.statusText || 'response not ok');
        logger.error(logText);
        throw logText;
      }
      return response.json().then(json => {
        if (json.status_code != 200) { // eslint-disable-line eqeqeq
          const logText = new PushwooshError(`Error occurred during the ${methodName} call to Pushwoosh: ${json.status_message}`);
          logger.error(logText);
          throw logText;
        }
        return json.response;
      });
    });
  };
}
