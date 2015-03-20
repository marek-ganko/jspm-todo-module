import template from './template.jade!';
import './style.css!';

export default class TodoListDirective {

  constructor(localStorage) {
    this.restrict = 'E';
    this.transclude = true;
    this.template = template;
    this.scope = {
      'onChange': '='
    };
  }

  link(scope, element, attrs) {
    
  }

  controller($scope) {

    this.addElement = function (params) {
     
    };

  }

}

TodoListDirective.$inject = ['localStorage'];