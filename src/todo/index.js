'use strict';
import register from '../utils/register';
import TodoDirective from './TodoDirective';

export default register('todoModule').directive('todo', TodoDirective);