import TodoList from './todoList/index';
import TodoItem from './todoItem/index';
import Providers from './providers/index';
import Services from './services/index';

export default angular.module('TodoModules', [Services.name, TodoList.name, TodoItem.name, Providers.name]);
console.log('ToDoModules loaded');