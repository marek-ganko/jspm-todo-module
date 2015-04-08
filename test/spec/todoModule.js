import TodoModule from  '../../src/Todo';
import angular from 'angular';

describe('Todo module', () => {

  it('should exist', done => {
    expect(angular.module('todoModules')).not.toEqual(null);
    done();
  });

});
