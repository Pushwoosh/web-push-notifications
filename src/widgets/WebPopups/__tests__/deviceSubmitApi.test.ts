import { type WebPopupFormValues } from '@pushwoosh/websdk-common/web-popups';

import { type Logger } from '../../../core/logger';
import { type EventBus } from '../../../core/modules/EventBus';
import { type Pushwoosh } from '../../../core/Pushwoosh';
import { Api } from '../../../modules/Api/Api';
import { ApiClient } from '../../../modules/ApiClient/ApiClient';
import { type Data } from '../../../modules/Data/Data';
import { createFormValuesSubmitHandler } from '../deviceSubmitApi';

const ENTRYPOINT = 'https://api.example.com/json/1.3/';

const VALUES: WebPopupFormValues = { email: 'visitor@example.com', tags: { City: 'Berlin' }, policyAccepted: true };

function buildData(): Data {
  return <Data><unknown>{
    getApiEntrypoint: jest.fn().mockResolvedValue(ENTRYPOINT),
    setApiEntrypoint: jest.fn().mockResolvedValue(undefined),
    getApiToken: jest.fn().mockResolvedValue(''),
    getApplicationCode: jest.fn().mockResolvedValue('AAAAA-BBBBB'),
    getHwid: jest.fn().mockResolvedValue('visitor-hwid'),
    getUserId: jest.fn().mockResolvedValue(''),
    getDeviceModel: jest.fn().mockResolvedValue('Chrome 153'),
    getDeviceType: jest.fn().mockResolvedValue(11),
    getLanguage: jest.fn().mockResolvedValue('en'),
    getSdkVersion: jest.fn().mockResolvedValue('3.97.0'),
  };
}

function submitterFor(campaignCode: string, isCommunicationDisabled = false) {
  const data = buildData();
  const apiClient = new ApiClient(data, <typeof Logger><unknown>{ write: jest.fn() });
  const api = new Api(<EventBus><unknown>{ dispatchEvent: jest.fn() }, data, apiClient, () => isCommunicationDisabled);

  return createFormValuesSubmitHandler(<Pushwoosh><unknown>{ api }, campaignCode);
}

// jsdom has no fetch Response; ApiClient reads only status, statusText and json().
function reply(status: number, body?: unknown): Response {
  return <Response><unknown>{
    status,
    statusText: '',
    json: async () => {
      if (body === undefined) {
        throw new SyntaxError('Unexpected end of JSON input');
      }
      return body;
    },
  };
}

const envelope = (response: unknown): Response => reply(200, { status_code: 200, status_message: 'OK', response });

const originalFetch = globalThis.fetch;
let fetchMock: jest.Mock;

beforeEach(() => {
  fetchMock = jest.fn();
  globalThis.fetch = fetchMock;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('createFormValuesSubmitHandler', () => {
  it('sends the values under the campaign code with the visitor hwid and opens Success on OK', async () => {
    fetchMock.mockResolvedValue(envelope({ result: 'OK' }));

    await expect(submitterFor('CAMPAIGN-1')(VALUES)).resolves.toBe('ok');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${ENTRYPOINT}submitPopupForm`);
    expect(JSON.parse(init.body).request).toMatchObject({
      application: 'AAAAA-BBBBB',
      hwid: 'visitor-hwid',
      device_type: 11,
      code: 'CAMPAIGN-1',
      email: 'visitor@example.com',
      tags: { City: 'Berlin' },
      policy_accepted: true,
    });
  });

  it('reports an invalid email', async () => {
    fetchMock.mockResolvedValue(envelope({ result: 'INVALID_EMAIL' }));

    await expect(submitterFor('CAMPAIGN-1')(VALUES)).resolves.toBe('invalid-email');
  });

  it.each([
    ['the campaign is not active or not a form', () => reply(200, { status_code: 210, status_message: 'failed precondition' })],
    ['the relaxed API refuses the request', () => reply(400, { status_code: 210, status_message: 'invalid argument' })],
    ['the campaign does not exist', () => reply(404)],
    ['the server fails', () => reply(500, {})],
    ['the result is unknown', () => envelope({ result: 'UNSPECIFIED' })],
  ])('rejects when %s', async (_case, response) => {
    fetchMock.mockResolvedValue(response());

    await expect(submitterFor('CAMPAIGN-1')(VALUES)).rejects.toThrow();
  });

  it('rejects when the network is down', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(submitterFor('CAMPAIGN-1')(VALUES)).rejects.toThrow('Failed to fetch');
  });

  it('sends nothing while communication is disabled', async () => {
    await expect(submitterFor('CAMPAIGN-1', true)(VALUES)).rejects.toThrow('Communication is disabled');

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
