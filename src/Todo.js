import TodoList from './todoList/index';
import TodoItem from './todoItem/index';
import Providers from './providers/index';
import Services from './services/index';
import 'angular-route';

console.log(TodoList);
export default angular.module('TodoModules', ['ngRoute', Services.name, TodoList.name, TodoItem.name, Providers.name]);
console.log('ToDoModules loaded');