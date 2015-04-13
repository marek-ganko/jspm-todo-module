'use strict';
import StorageFactory from './StorageFactory';
import angular from 'angular';

class ExampleService {
  constructor($http) {
    this.$http = $http;
  }

  getSomeContent(){
    this.$http.get('src/Todo.js').then((Todo) => {
      console.info(Todo);
    });
  }
}

class ExampleFactory {
  constructor($http) {
    this.$http = $http;
  }

  getSomeContent(){
    this.$http.get('src/Todo.js').then((Todo) => {
      console.info(Todo);
    });
  }

  getContentInjector($http){
    this.$http.get('src/Todo.js').then((Todo) => {
      console.info(Todo);
    });
  }

}

export default angular.module('todo.services', [])
    .factory('StorageFactory', () => StorageFactory)
    .constant('exampleService', ExampleService)
    .factory('exampleFactory', ($http) => new ExampleFactory($http));
