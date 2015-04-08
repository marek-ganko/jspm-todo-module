'use strict';
import {Storage} from './Storage';
import angular from 'angular';

const STORAGE_ID = 'todo-module';

export default class LocalStorage extends Storage {

  constructor() {
    this.items = this.StorageItems;
  }

  /**
   * @returns {Array}
   */
  get StorageItems() {
    return JSON.parse(localStorage.getItem(STORAGE_ID) || '[]');
  }

  /**
   * @returns {Promise}
   */
  setStorageItems() {
    return new Promise((resolve, reject) => {
      localStorage.setItem(STORAGE_ID, JSON.stringify(this.items));
      resolve(this.items);
    });
  }

  /**
   * @param {*} item
   * @returns {Promise}
   */
  add(item) {
    return new Promise((resolve, reject) => {
      this.items.push(item);
      this.setStorageItems().then((items) => {
        resolve(items);
      });
    });
  }

  /**
   * @param item
   * @returns {Promise}
   */
  save(item) {
    return new Promise((resolve, reject) => {
      this.items[this.items.indexOf(item)] = item;
      this.setStorageItems().then((items) => {
        resolve(items);
      });
    });
  }

  /**
   * @param item
   * @returns {Promise}
   */
  remove(item) {
    return new Promise((resolve, reject) => {
      this.items.splice(this.items.indexOf(item), 1);
      this.setStorageItems().then((items) => {
        resolve(items);
      });
    });
  }

  /**
   * @returns {*}
   */
  get() {
    return this.items;
  }

  filter(callback) {
    return new Promise((resolve, reject) => {
      let incompleteTodos = this.items.filter(callback);
      angular.copy(incompleteTodos, this.items);
      this.setStorageItems().then((items) => {
        resolve(items);
      });
    });
  }
}