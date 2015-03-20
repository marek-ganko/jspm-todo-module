import 'angular';
import TodoModules from './Todo';

var app = angular.module('app', [TodoModules.name]);
console.log("application : ", app.name, " started");
angular.element(document).ready(function () {
  angular.bootstrap(document, [app.name]);
});