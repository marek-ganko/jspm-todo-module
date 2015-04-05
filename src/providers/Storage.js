export class Storage {

  constructor() {
    throw Error('Abstract class');
  }

  add(item) {
    throw Error('add Not implemented');
  }

  save(item) {
    throw Error('save Not implemented');
  }

  remove(item) {
    throw Error('remove Not implemented');
  }

  get() {
    throw Error('get Not implemented');
  }
}