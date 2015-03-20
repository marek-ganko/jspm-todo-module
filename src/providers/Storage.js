export class Storage {

  constructor() {
    throw Error('Abstract class');
  }

  add() {
    throw Error('add Not implemented');
  }

  save() {
    throw Error('save Not implemented');
  }

  remove(element) {
    throw Error('remove Not implemented');
  }

  get(element) {
    throw Error('get Not implemented');
  }

  getAll() {
    throw Error('getAll Not implemented');
  }
}