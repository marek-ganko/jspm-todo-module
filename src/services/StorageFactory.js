'use strict';
import LocalStorage from './LocalStorage';
import CookieStorage from './CookieStorage';

export default class StorageFactory {
  constructor(storageType = 'localStorage') {
    this.storage = null;

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
