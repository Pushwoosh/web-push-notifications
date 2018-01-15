const objectStoreKeyValueName = 'keyValue';
const objectStoreLogName = 'logs';
const objectStoreMessagesName = 'messages';


function onversionchange(event: any) {
  console.info('onversionchange', event);
}

let databasePromise: Promise<IDBDatabase>;
function getInstance(): Promise<IDBDatabase> {
  if (!databasePromise) {
    databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request: IDBOpenDBRequest = indexedDB.open('PUSHWOOSH_SDK_STORE', 6);
      request.onsuccess = (event) => {
        const database: IDBDatabase = (event.target as IEevetTargetWithResult).result;
        database.onversionchange = onversionchange;
        resolve(database);
      };

      request.onerror = () => reject(request.error);

      request.onupgradeneeded = (event) => {
        const database: IDBDatabase = (event.target as IEevetTargetWithResult).result;
        database.onversionchange = onversionchange;

        if (!database.objectStoreNames.contains(objectStoreKeyValueName)) {
          database.createObjectStore(objectStoreKeyValueName, {keyPath: 'key'});
        }

        const autoIncrementId = {keyPath: 'id', autoIncrement: true};
        const uniqueFalse = {unique: false};
        if (!database.objectStoreNames.contains(objectStoreLogName)) {
          const logStore = database.createObjectStore(objectStoreLogName, autoIncrementId);
          logStore.createIndex('environment', 'environment', uniqueFalse);
          logStore.createIndex('date', 'date', uniqueFalse);
          logStore.createIndex('type', 'type', uniqueFalse);
        }
        if (!database.objectStoreNames.contains(objectStoreMessagesName)) {
          const messagesStore = database.createObjectStore(objectStoreMessagesName, autoIncrementId);
          messagesStore.createIndex('date', 'date', uniqueFalse);
        }
      };
    });
  }
  return databasePromise;
}

function getInstanceWithPromise(executor: any): any {
  return getInstance().then(database => (
    new Promise((resolve, reject) => executor(database, resolve, reject))
  ));
}

function createKeyValue(name: string) {
  return {
    get(key: string) {
      return getInstanceWithPromise((database: IDBDatabase, resolve: any, reject: any) => {
        const request = database.transaction(name).objectStore(name).get(key);
        request.onsuccess = () => {
          const {result} = request;
          resolve(result && result.value);
        };
        request.onerror = () => {
          reject(request.error);
        };
      });
    },

    getAll() {
      return getInstanceWithPromise((database: IDBDatabase, resolve: any, reject: any) => {
        const result: {[key: string]: any} = {};
        const cursor = database.transaction(name).objectStore(name).openCursor();
        cursor.onsuccess = (event) => {
          const cursorResult = (event.target as any).result;
          if (cursorResult) {
            result[cursorResult.key] = cursorResult.value.value;
            cursorResult.continue();
          }
          else {
            resolve(result);
          }
        };
        cursor.onerror = () => {
          reject(cursor.error);
        };
      });
    },

    async extend(key: string, value: any) {
      const oldValues = await this.get(key);
      const {...newValues} = value;
      await this.set(key, {...oldValues, ...newValues});
    },

    set(key: string, value: any) {
      return getInstanceWithPromise((database: IDBDatabase, resolve: any, reject: any) => {
        const request = database.transaction([name], 'readwrite').objectStore(name).put({key, value});
        request.onsuccess = () => {
          resolve(key);
        };
        request.onerror = () => {
          reject(request.error);
        };
      });
    }
  };
}


export abstract class LogBase {
  protected abstract name: string;
  protected abstract maxItems: number;
  _add(obj: any) {
    return getInstanceWithPromise((database: IDBDatabase, resolve: any, reject: any) => {
      const request = database.transaction([this.name], 'readwrite').objectStore(this.name).add(obj);
      request.onsuccess = () => {
        resolve(obj);
      };
      request.onerror = () => {
        reject(request.error);
      };
    }).then((obj: any) => {
      return this.getAll().then((items: {id: number}[]) => {
        if (Array.isArray(items)) {
          const ids = items.map(i => i.id).sort((a, b) => {
            if (a == b) return 0;
            return a < b ? 1 : -1;
          });
          if (ids.length > this.maxItems) {
            return Promise.all(ids.slice(this.maxItems).map(id => this.delete(id))).then(() => obj)
          }
        }
        return obj;
      });
    });
  }

  delete(key: any) {
    return getInstanceWithPromise((database: IDBDatabase, resolve: any, reject: any) => {
      const request = database.transaction([this.name], 'readwrite').objectStore(this.name).delete(key);
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  getAll() {
    return getInstanceWithPromise((database: IDBDatabase, resolve: any, reject: any) => {
      const result: any[] = [];
      const cursor = database.transaction(this.name).objectStore(this.name).openCursor();
      cursor.onsuccess = (ev) => {
        const cursorResult = (ev.target as any).result;
        if (cursorResult) {
          result.push(cursorResult.value);
          cursorResult.continue();
        }
        else {
          resolve(result);
        }
      };
      cursor.onerror = () => {
        reject(cursor.error);
      };
    });
  }
}

export class LogLog extends LogBase {
  protected name = objectStoreLogName;
  protected maxItems = 100;
  protected environment = (typeof self !== 'undefined' && self.registration) ? 'worker' : 'browser';
  add(type: string, message: any, additional?: any) {
    const obj: any = {
      type,
      environment: this.environment,
      message: `${message}`,
      date: new Date
    };
    if (message instanceof Error) {
      obj.stack = message.stack;
    }
    if (additional) {
      obj.additional = additional;
    }
    return this._add(obj);
  }
}

export class LogMessage extends LogBase {
  protected name = objectStoreMessagesName;
  protected maxItems = 25;
  add(log: any) {
    return this._add({
      ...log,
      date: new Date
    });
  }
}

export const keyValue = createKeyValue(objectStoreKeyValueName);
export const log = new LogLog();
export const message = new LogMessage();
