'use strict';
import LocalStorage from './LocalStorage';

export default angular.module('todo.providers', []).service('todoStorage', LocalStorage);