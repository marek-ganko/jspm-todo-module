'use strict';
import TodoModule from './todo/index';
import Services from './services/index';
import angular from 'angular';

export default angular.module('todoModules', [Services.name, TodoModule.name]);