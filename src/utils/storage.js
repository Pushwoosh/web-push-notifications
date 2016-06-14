
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

class KeyValueStore {
  constructor(name) {
    this.name = name;
  }

  get(key) {
    return getInstance().then(database => {
      return new Promise((resolve, reject) => {
        const request = database.transaction(this.name).objectStore(this.name).get(key);
        request.onsuccess = () => {
          const {result} = request;
          resolve(result && result.value);
        };
        request.onerror = () => {
          reject(request.errorCode);
        };
      });
    });
  }

  set(key, value) {
    return getInstance().then(database => {
      return new Promise((resolve, reject) => {
        const request = database.transaction([this.name], 'readwrite').objectStore(this.name).put({key, value});
        request.onsuccess = () => {
          resolve(key);
        };
        request.onerror = (e) => {
          reject(e);
        };
      });
    });
  }
}

export const keyValue = new KeyValueStore('keyValue');
