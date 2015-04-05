import template from './template.jade!';
import './style.css!';
import 'todomvc-common';
import 'todomvc-common/base.css!';
import 'todomvc-app-css/index.css!';
import angular from 'angular';

export default class TodoListDirective {

  constructor() {
    this.restrict = 'E';
    this.template = template;
    this.scope = {};
  }

  link(scope, element, attrs) {
  }

  controller($scope, $routeParams, $filter, todoStorage) {

    $scope.todos = [];
    $scope.newTodo = '';
    $scope.editedTodo = null;
    let todos = $scope.todos = todoStorage.get();

    $scope.$watch('todos', function () {
      $scope.remainingCount = $filter('filter')(todos, {completed: false}).length;
      $scope.completedCount = todos.length - $scope.remainingCount;
      $scope.allChecked = !$scope.remainingCount;
    }, true);

    // Monitor the current route for changes and adjust the filter accordingly.
    $scope.$on('$routeChangeSuccess', function () {
      var status = $scope.status = $routeParams.status || '';

      $scope.statusFilter = (status === 'active') ?
      {completed: false} : (status === 'completed') ?
      {completed: true} : null;
    });

    $scope.addTodo = function () {
      let newTodo = {
        title: $scope.newTodo.trim(),
        completed: false
      };

      if (!newTodo.title) {
        return;
      }

      $scope.saving = true;

      todoStorage.add(newTodo)
        .then(() => {
          $scope.newTodo = '';
          $scope.saving = false;
        }).then(() => {

        });
    };

    $scope.editTodo = function (todo) {
      $scope.editedTodo = todo;
      // Clone the original todo to restore it on demand.
      $scope.originalTodo = angular.extend({}, todo);
    };

    $scope.saveEdits = function (todo, event) {
      // Blur events are automatically triggered after the form submit event.
      // This does some unfortunate logic handling to prevent saving twice.
      if (event === 'blur' && $scope.saveEvent === 'submit') {
        $scope.saveEvent = null;
        return;
      }

      $scope.saveEvent = event;

      if ($scope.reverted) {
        // Todo edits were reverted-- don't save.
        $scope.reverted = null;
        return;
      }

      todo.title = todo.title.trim();

      if (todo.title === $scope.originalTodo.title) {
        $scope.editedTodo = null;
        return;
      }

      todoStorage.save(todo)
        .catch(() => {
          todo.title = $scope.originalTodo.title;
        })
        .then(() => {
          $scope.editedTodo = null;
        });
    };

    $scope.revertEdits = function (todo) {
      todos[todos.indexOf(todo)] = $scope.originalTodo;
      $scope.editedTodo = null;
      $scope.originalTodo = null;
      $scope.reverted = true;
    };

    $scope.removeTodo = function (todo) {
      todoStorage.remove(todo);
    };

    $scope.toggleCompleted = function (todo) {
      todoStorage.save(todo)
        .catch((error) => {
          throw error;
        });
    };

    $scope.clearCompletedTodos = function () {
      todoStorage.filter((todo) => {
        return !todo.completed;
      });
    };

    $scope.markAll = function (completed) {
      console.log(todos, completed);
      todos.forEach(function (todo) {
        if (todo.completed !== completed) {
          todo.completed = !todo.completed;
          $scope.toggleCompleted(todo);
        }
      });
    };
  }

}

TodoListDirective.$inject = ['todoStorage'];