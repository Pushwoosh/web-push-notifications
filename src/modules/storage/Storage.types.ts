export type TKeyValueStoreName = 'keyValue';
export type TMessageLogStoreName = 'messages';
export type TMainLogStoreName = 'log';
export type TInboxMessagesStoreName = 'inboxMessages';
export type TSdkStoreName =
  | TKeyValueStoreName
  | TMessageLogStoreName
  | TInboxMessagesStoreName
  | TMainLogStoreName;

export type TMigrationType = (database: IDBDatabase) => void;

export interface IIDBOpenEventTargetWithResult extends EventTarget {
  result: IDBDatabase;
}

export interface IIDBGetTransactionEventTargetWithResult extends EventTarget {
  result: any;
}

export type TIDBKeyType = string | number | Date;
export type TIDBQueryValue = TIDBKeyType | IDBKeyRange;

export interface IDBIndex {
  getAll(query?: TIDBQueryValue, count?: number): IDBRequest;
}

export interface IDBObjectStore {
  getAll(query?: TIDBQueryValue, count?: number): IDBRequest;
}
