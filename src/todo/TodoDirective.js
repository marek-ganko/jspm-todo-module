'use strict';
import template from './template.jade!';
import 'todomvc-common';
import 'todomvc-common/base.css!';
import 'todomvc-app-css/index.css!';
import './style.css!';
import todoModule from './module';
import angular from 'angular';

todoModule.directive('todo', function(StorageFactory) {
  return {
    restrict: 'E',
    template: template,
    scope: {
      storage: '@'
    },

    controller: ($scope, $filter) => {

      let storage = new StorageFactory($scope.storage).get();
      let todos = $scope.todos = storage.get();
      $scope.newTodo = '';
      $scope.editedTodo = null;

      $scope.$watch('todos', () => {
        $scope.remainingCount = $filter('filter')(todos, {completed: false}).length;
        $scope.completedCount = todos.length - $scope.remainingCount;
        $scope.allChecked = !$scope.remainingCount;
      }, true);

      $scope.onStatusChange = (status) => {
        $scope.statusFilter = (status === 'active') ?
        {completed: false} : (status === 'completed') ?
        {completed: true} : {};
      };

      $scope.addTodo = () => {
        if (!$scope.newTodo) {
          return;
        }
        let newTodo = {
          title: $scope.newTodo.trim(),
          completed: false
        };

        storage.add(newTodo).then(function success() {
          $scope.newTodo = null;
          $scope.$apply();
        });
      };

      $scope.editTodo = (todo) => {
        $scope.editedTodo = todo;
        $scope.originalTodo = angular.extend({}, todo);
      };

      $scope.saveEdits = (todo, event) => {
        if (event === 'blur' && $scope.saveEvent === 'submit') {
          $scope.saveEvent = null;
          return;
        }

        $scope.saveEvent = event;

        if ($scope.reverted) {
          $scope.reverted = null;
          return;
        }

        todo.title = todo.title.trim();

        if (todo.title === $scope.originalTodo.title) {
          $scope.editedTodo = null;
          return;
        }

        storage.save(todo).catch(() => {
          todo.title = $scope.originalTodo.title;
        }).then(() => {
          $scope.editedTodo = null;
        });
      };

      $scope.revertEdits = (todo) => {
        todos[todos.indexOf(todo)] = $scope.originalTodo;
        $scope.editedTodo = null;
        $scope.originalTodo = null;
        $scope.reverted = true;
      };

      $scope.removeTodo = (todo) => {
        storage.remove(todo);
      };

      $scope.toggleCompleted = (todo) => {
        storage.save(todo)
          .catch((error) => {
            throw error;
          });
      };

      $scope.clearCompletedTodos = () => {
        storage.filter((todo) => {
          return !todo.completed;
        });
      };

      $scope.markAll = (completed) => {
        todos.forEach((todo) => {
          if (todo.completed !== completed) {
            todo.completed = !todo.completed;
            $scope.toggleCompleted(todo);
          }
        });
      };
    }
  };

});
