
let instance;

function getInstance() {
  return new Promise((resolve, reject) => {
    if (instance) {
      resolve(instance);
    }
    else {
      const request = indexedDB.open('PUSHWOOSH_SDK_STORE', 2);
      request.onsuccess = (event) => {
        const database = event.target.result;
        if (instance) {
          database.close();
          resolve(instance);
        }
        else {
          instance = database;
          resolve(database);
        }
      };
      request.onerror = (event) => {
        reject(event);
      };
      request.onupgradeneeded = (event) => {
        const database = event.target.result;
        database.createObjectStore('keyValue', {
          keyPath: 'key'
        });
      };
      request.onversionchange = (event) => {
        console.info('The database is about to be deleted.', event); // eslint-disable-line
      };
    }
  });
}

function createKeyValue(name) {
  return {
    get(key) {
      return getInstance().then(database => {
        return new Promise((resolve, reject) => {
          const request = database.transaction(name).objectStore(name).get(key);
          request.onsuccess = () => {
            const {result} = request;
            resolve(result && result.value);
          };
          request.onerror = () => {
            reject(request.errorCode);
          };
        });
      });
    },

    getAll() {
      return getInstance().then(database => {
        return new Promise((resolve, reject) => {
          const result = {};
          const cursor = database.transaction(name).objectStore(name).openCursor();
          cursor.onsuccess = (event) => {
            const cursorResult = event.target.result;
            if (cursorResult) {
              result[cursorResult.key] = cursorResult.value.value;
              cursorResult.continue();
            }
            else {
              resolve(result);
            }
          };
          cursor.onerror = () => {
            reject(cursor.errorCode);
          };
        });
      });
    },

    set(key, value) {
      return getInstance().then(database => {
        return new Promise((resolve, reject) => {
          const request = database.transaction([name], 'readwrite').objectStore(name).put({key, value});
          request.onsuccess = () => {
            resolve(key);
          };
          request.onerror = (e) => {
            reject(e);
          };
        });
      });
    }
  };
}

export const keyValue = createKeyValue('keyValue');
