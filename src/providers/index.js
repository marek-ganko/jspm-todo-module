import register from '../utils/register';
import LocalStorage from './LocalStorage';

export default register('todo.providers', [])
	.service('localStorage', LocalStorage);