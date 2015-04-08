'use strict';
import angular from 'angular';
import TodoModules from './Todo';

var app = angular.module('app', [TodoModules.name]);
angular.element(document).ready(function () {
  angular.bootstrap(document, [app.name]);
});