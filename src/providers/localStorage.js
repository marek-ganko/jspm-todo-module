import {Storage} from './Storage';

export default class LocalStorage extends Storage {

  constructor() {
    console.log('LocalStorage Initiated');
  }

  add() {
    console.log('add');
  }

  save() {
    console.log('save');
  }

  remove(element) {
    console.log('remove');
  }

  get(element) {
    console.log('get');
  }

  getAll() {
    console.log('getAll');
  }
}