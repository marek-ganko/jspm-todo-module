'use strict';
import TodoDirective from './TodoDirective';
import angular from 'angular';

export default angular.module('todoModule', []).directive('todo',  TodoDirective);