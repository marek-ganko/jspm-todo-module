'use strict';
import LocalStorage from './storage/LocalStorage';
import CookieStorage from './storage/CookieStorage';

export default class StorageFactory {
  constructor(storageType = 'localStorage') {
    switch (storageType) {
      case 'localStorage':
        this.storage = new LocalStorage();
        break;
      case 'cookies':
        this.storage = new CookieStorage();
        break;
      default:
        throw new Error('Unknown storage type: ' + storageType);
    }
  }

  get() {
    return this.storage;
  }
}

