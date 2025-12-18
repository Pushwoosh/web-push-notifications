import {
  STORE_NAME_INBOX_MESSAGES,
} from './constants';
import { storeCreatorDecorator } from './helpers';
import {
  type TInboxMessagesIDBKeyPath,
  type TInboxMessagesIDBRemovalTimeIndex,
  type TInboxMessagesIDBStatusIndex,
} from '../../../models/InboxMessages.types';

function createInboxMessagesStore(database: IDBDatabase) {
  const keyPath: TInboxMessagesIDBKeyPath = 'inbox_id';
  const statusIndex: TInboxMessagesIDBStatusIndex = 'status';
  const removalTimeIndex: TInboxMessagesIDBRemovalTimeIndex = 'rt';

  const store = database.createObjectStore(STORE_NAME_INBOX_MESSAGES,
    { keyPath, autoIncrement: false },
  );
  store.createIndex(statusIndex, statusIndex, { unique: false, multiEntry: true });
  store.createIndex(removalTimeIndex, removalTimeIndex, { unique: false, multiEntry: true });
}

export default [
  storeCreatorDecorator(STORE_NAME_INBOX_MESSAGES, createInboxMessagesStore),
];
