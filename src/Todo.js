'use strict';
import './todo/index';
import TodoModule from './todo/module';
import Services from './services/index';
import angular from 'angular';

export default angular.module('todoModules', [Services.name, TodoModule.name]);