'use strict';
import StorageFactory from './StorageFactory';
import angular from 'angular';

export default angular.module('todo.services', []).factory('StorageFactory', () => {
  return StorageFactory;
});