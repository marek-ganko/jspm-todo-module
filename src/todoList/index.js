import register from '../utils/register';
import TodoListDirective from './TodoListDirective';

export default register('')
  .directive('todoList', TodoListDirective);


console.log('directive todoList loaded');