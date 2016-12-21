import Logger, {logAndThrowError} from './logger';

export default function createDoApiFetch(pushwooshUrl: string) {
  return function doApiFetch(methodName: string, request: any) {
    const url = `${pushwooshUrl}${methodName}`;
    const params = {request};

    return fetch(url, {
      method: 'post',
      headers: {'Content-Type': 'text/plain;charset=UTF-8'},
      body: JSON.stringify(params)
    }).then((response) => {
      if (!response.ok) {
        logAndThrowError(response.statusText || 'response not ok');
      }
      return response.json().then((json: any) => {
        if (json.status_code != 200) {
          logAndThrowError(`Error occurred during the ${methodName} call to Pushwoosh: ${json.status_message}`);
        }
        Logger.write('apirequest', `${methodName} call with arguments: ${JSON.stringify(request)} to Pushwoosh has been successful. Result: ${JSON.stringify(json.response)}`, 'createDoApiFetch');
        return json.response;
      });
    });
  };
}
