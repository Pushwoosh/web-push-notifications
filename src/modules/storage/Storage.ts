import { type TIDBKeyType, type TIDBQueryValue, type TSdkStoreName } from './Storage.types';
import Store from './Store';
import { getInstance } from '../../core/storage';

export default class Storage {
  /**
   * Get database instance (uses shared connection from core/storage)
   */
  getDB(): Promise<IDBDatabase> {
    return getInstance();
  }

  /**
   * https://developer.mozilla.org/en-US/docs/Web/API/IDBObjectStore/put
   * @param storeName
   * @param data
   * @param key
   */
  async put(storeName: TSdkStoreName, data: any, key?: string) {
    const db = await this.getDB();
    const store = new Store(db, storeName);
    return store.put(data, key);
  }

  /**
   * https://developer.mozilla.org/en-US/docs/Web/API/IDBObjectStore/delete
   * @param storeName
   * @param key
   */
  async delete(storeName: TSdkStoreName, key: string | number) {
    const db = await this.getDB();
    const store = new Store(db, storeName);
    return store.delete(key);
  }

  /**
   * https://developer.mozilla.org/en-US/docs/Web/API/IDBObjectStore/get
   * @param storeName
   * @param key
   * @param defaultValue
   */
  async get<Response, D>(
    storeName: TSdkStoreName,
    key: TIDBKeyType,
    defaultValue?: D,
  ): Promise<Response | D> {
    const db = await this.getDB();
    const store = new Store(db, storeName);
    return store.get<Response, D>(key, defaultValue);
  }

  /**
   * https://developer.mozilla.org/en-US/docs/Web/API/IDBObjectStore/getAll
   * @param storeName
   */
  async getAll<Response>(
    storeName: TSdkStoreName,
  ): Promise<Array<Response>> {
    const db = await this.getDB();
    const store = new Store(db, storeName);
    return (await store.getAll<Response>()) || [];
  }

  /**
   * https://developer.mozilla.org/en-US/docs/Web/API/IDBObjectStore/count
   * @param storeName
   * @param query
   */
  async count(
    storeName: TSdkStoreName,
    query?: IDBKeyRange,
  ): Promise<number> {
    const db = await this.getDB();
    const store = new Store(db, storeName);
    return store.count(query);
  }

  /**
   * https://developer.mozilla.org/en-US/docs/Web/API/IDBIndex/count
   * @param storeName
   * @param indexName
   * @param key
   */
  async countByIndex(
    storeName: TSdkStoreName,
    indexName: string,
    key?: TIDBQueryValue,
  ): Promise<number> {
    const db = await this.getDB();
    const store = new Store(db, storeName);
    store.index = indexName;
    return store.countByIndex(key);
  }
}
