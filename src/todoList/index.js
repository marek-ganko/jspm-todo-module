import register from '../utils/register';
import TodoListDirective from './TodoListDirective';

export default register('todoList')
  .directive('todo', TodoListDirective);


console.log('directive todoList loaded');