'use strict';
import {Storage} from './Storage';

const STORAGE_ID = 'todo-module';

export default class LocalStorage extends Storage {

  constructor() {
    super(this);
  }

  /**
   * @returns {Array}
   */
  getFromStorage() {
    return JSON.parse(localStorage.getItem(STORAGE_ID) || '[]');
  }

  /**
   * @returns {Promise}
   */
  saveOnStorage(items) {
    return new Promise((resolve, reject) => {
      localStorage.setItem(STORAGE_ID, JSON.stringify(items));
      resolve(items);
    });
  }
}