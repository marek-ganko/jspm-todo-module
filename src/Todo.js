'use strict';
import TodoModule from './todo/index';
import Services from './services/index';
import angular from 'angular';
import 'angular-route';

export default angular.module('todoModules', ['ngRoute', Services.name, TodoModule.name]);