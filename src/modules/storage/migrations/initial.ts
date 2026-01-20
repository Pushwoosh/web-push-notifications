import {
  STORE_NAME_INBOX_MESSAGES,
  STORE_NAME_KEY_VALUE,
  STORE_NAME_MAIN_LOG,
  STORE_NAME_MESSAGE_LOG,
  KEY_PATH_BASE_INCREMENT,
} from './constants';
import { storeCreatorDecorator } from './helpers';
import {
  type TInboxMessagesIDBKeyPath,
  type TInboxMessagesIDBRemovalTimeIndex,
  type TInboxMessagesIDBStatusIndex,
} from '../../../models/InboxMessages.types';

/**
 * Create keyValue store migration
 * @param database
 */
function createKeyValueStore(database: IDBDatabase) {
  database.createObjectStore(STORE_NAME_KEY_VALUE, { keyPath: 'key' });
}

/**
 * Create log store migration
 * @param database
 */
function createLogStore(database: IDBDatabase) {
  const logStore = database.createObjectStore(
    STORE_NAME_MAIN_LOG,
    { keyPath: KEY_PATH_BASE_INCREMENT, autoIncrement: true },
  );
  logStore.createIndex('environment', 'environment', { unique: false });
  logStore.createIndex('date', 'date', { unique: false });
  logStore.createIndex('type', 'type', { unique: false });
}

/**
 * Create message log store migration
 * @param database
 */
function createMessageLogStore(database: IDBDatabase) {
  const messagesStore = database.createObjectStore(
    STORE_NAME_MESSAGE_LOG,
    { keyPath: KEY_PATH_BASE_INCREMENT, autoIncrement: true },
  );
  messagesStore.createIndex('date', 'date', { unique: false });
}

/**
 * Create inbox messages store migration
 * @param database
 */
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
  storeCreatorDecorator(STORE_NAME_KEY_VALUE, createKeyValueStore),
  storeCreatorDecorator(STORE_NAME_MAIN_LOG, createLogStore),
  storeCreatorDecorator(STORE_NAME_MESSAGE_LOG, createMessageLogStore),
  storeCreatorDecorator(STORE_NAME_INBOX_MESSAGES, createInboxMessagesStore),
];
