"format register";


System.register("src/utils/register", [], function (_export) {
  var _applyConstructor;

  /**
   * A helper class to simplify registering Angular components and provide a consistent syntax for doing so.
   */

  _export("default", register);

  function register(appName, dependencies) {

    var app = safeRegister(appName, dependencies);

    return {
      name: appName,
      directive: directive,
      controller: controller,
      service: service,
      provider: provider,
      factory: factory
    };

    function safeRegister(appName, dependencies) {
      try {
        return angular.module(appName);
      } catch (e) {
        return angular.module(appName, dependencies || []);
      }
    }

    function directive(name, constructorFn) {

      constructorFn = _normalizeConstructor(constructorFn);

      if (!constructorFn.prototype.compile) {
        // create an empty compile function if none was defined.
        constructorFn.prototype.compile = function () {};
      }

      var originalCompileFn = _cloneFunction(constructorFn.prototype.compile);

      // Decorate the compile method to automatically return the link method (if it exists)
      // and bind it to the context of the constructor (so `this` works correctly).
      // This gets around the problem of a non-lexical "this" which occurs when the directive class itself
      // returns `this.link` from within the compile function.
      _override(constructorFn.prototype, "compile", function () {
        return function () {
          originalCompileFn.apply(this, arguments);

          if (constructorFn.prototype.link) {
            return constructorFn.prototype.link.bind(this);
          }
        };
      });

      var factoryArray = _createFactoryArray(constructorFn);

      app.directive(name, factoryArray);
      return this;
    }

    function controller(name, contructorFn) {
      app.controller(name, contructorFn);
      return this;
    }

    function service(name, contructorFn) {
      app.service(name, contructorFn);
      return this;
    }

    function provider(name, constructorFn) {
      app.provider(name, constructorFn);
      return this;
    }

    function factory(name, constructorFn) {
      constructorFn = _normalizeConstructor(constructorFn);
      var factoryArray = _createFactoryArray(constructorFn);
      app.factory(name, factoryArray);
      return this;
    }

    /**
     * If the constructorFn is an array of type ['dep1', 'dep2', ..., constructor() {}]
     * we need to pull out the array of dependencies and add it as an $inject property of the
     * actual constructor function.
     * @param input
     * @returns {*}
     * @private
     */
    function _normalizeConstructor(input) {
      var constructorFn;

      if (input.constructor === Array) {
        //
        var injected = input.slice(0, input.length - 1);
        constructorFn = input[input.length - 1];
        constructorFn.$inject = injected;
      } else {
        constructorFn = input;
      }

      return constructorFn;
    }

    /**
     * Convert a constructor function into a factory function which returns a new instance of that
     * constructor, with the correct dependencies automatically injected as arguments.
     *
     * In order to inject the dependencies, they must be attached to the constructor function with the
     * `$inject` property annotation.
     *
     * @param constructorFn
     * @returns {Array.<T>}
     * @private
     */
    function _createFactoryArray(constructorFn) {
      // get the array of dependencies that are needed by this component (as contained in the `$inject` array)
      var args = constructorFn.$inject || [];
      var factoryArray = args.slice(); // create a copy of the array
      // The factoryArray uses Angular's array notation whereby each element of the array is the name of a
      // dependency, and the final item is the factory function itself.
      factoryArray.push(function () {
        for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        return _applyConstructor(constructorFn, args);
      });

      return factoryArray;
    }

    /**
     * Clone a function
     * @param original
     * @returns {Function}
     */
    function _cloneFunction(original) {
      return function () {
        return original.apply(this, arguments);
      };
    }

    /**
     * Override an object's method with a new one specified by `callback`.
     * @param object
     * @param methodName
     * @param callback
     */
    function _override(object, methodName, callback) {
      object[methodName] = callback(object[methodName]);
    }
  }

  return {
    setters: [],
    execute: function () {
      "use strict";

      _applyConstructor = function (Constructor, args) { var instance = Object.create(Constructor.prototype); var result = Constructor.apply(instance, args); return result != null && (typeof result == "object" || typeof result == "function") ? result : instance; };
    }
  };
});
System.register("npm:jade@1.9.1/lib/runtime", ["@empty"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  'use strict';
  exports.merge = function merge(a, b) {
    if (arguments.length === 1) {
      var attrs = a[0];
      for (var i = 1; i < a.length; i++) {
        attrs = merge(attrs, a[i]);
      }
      return attrs;
    }
    var ac = a['class'];
    var bc = b['class'];
    if (ac || bc) {
      ac = ac || [];
      bc = bc || [];
      if (!Array.isArray(ac))
        ac = [ac];
      if (!Array.isArray(bc))
        bc = [bc];
      a['class'] = ac.concat(bc).filter(nulls);
    }
    for (var key in b) {
      if (key != 'class') {
        a[key] = b[key];
      }
    }
    return a;
  };
  function nulls(val) {
    return val != null && val !== '';
  }
  exports.joinClasses = joinClasses;
  function joinClasses(val) {
    return (Array.isArray(val) ? val.map(joinClasses) : (val && typeof val === 'object') ? Object.keys(val).filter(function(key) {
      return val[key];
    }) : [val]).filter(nulls).join(' ');
  }
  exports.cls = function cls(classes, escaped) {
    var buf = [];
    for (var i = 0; i < classes.length; i++) {
      if (escaped && escaped[i]) {
        buf.push(exports.escape(joinClasses([classes[i]])));
      } else {
        buf.push(joinClasses(classes[i]));
      }
    }
    var text = joinClasses(buf);
    if (text.length) {
      return ' class="' + text + '"';
    } else {
      return '';
    }
  };
  exports.style = function(val) {
    if (val && typeof val === 'object') {
      return Object.keys(val).map(function(style) {
        return style + ':' + val[style];
      }).join(';');
    } else {
      return val;
    }
  };
  exports.attr = function attr(key, val, escaped, terse) {
    if (key === 'style') {
      val = exports.style(val);
    }
    if ('boolean' == typeof val || null == val) {
      if (val) {
        return ' ' + (terse ? key : key + '="' + key + '"');
      } else {
        return '';
      }
    } else if (0 == key.indexOf('data') && 'string' != typeof val) {
      if (JSON.stringify(val).indexOf('&') !== -1) {
        console.warn('Since Jade 2.0.0, ampersands (`&`) in data attributes ' + 'will be escaped to `&amp;`');
      }
      ;
      if (val && typeof val.toISOString === 'function') {
        console.warn('Jade will eliminate the double quotes around dates in ' + 'ISO form after 2.0.0');
      }
      return ' ' + key + "='" + JSON.stringify(val).replace(/'/g, '&apos;') + "'";
    } else if (escaped) {
      if (val && typeof val.toISOString === 'function') {
        console.warn('Jade will stringify dates in ISO form after 2.0.0');
      }
      return ' ' + key + '="' + exports.escape(val) + '"';
    } else {
      if (val && typeof val.toISOString === 'function') {
        console.warn('Jade will stringify dates in ISO form after 2.0.0');
      }
      return ' ' + key + '="' + val + '"';
    }
  };
  exports.attrs = function attrs(obj, terse) {
    var buf = [];
    var keys = Object.keys(obj);
    if (keys.length) {
      for (var i = 0; i < keys.length; ++i) {
        var key = keys[i],
            val = obj[key];
        if ('class' == key) {
          if (val = joinClasses(val)) {
            buf.push(' ' + key + '="' + val + '"');
          }
        } else {
          buf.push(exports.attr(key, val, false, terse));
        }
      }
    }
    return buf.join('');
  };
  exports.escape = function escape(html) {
    var result = String(html).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    if (result === '' + html)
      return html;
    else
      return result;
  };
  exports.rethrow = function rethrow(err, filename, lineno, str) {
    if (!(err instanceof Error))
      throw err;
    if ((typeof window != 'undefined' || !filename) && !str) {
      err.message += ' on line ' + lineno;
      throw err;
    }
    try {
      str = str || require('@empty').readFileSync(filename, 'utf8');
    } catch (ex) {
      rethrow(err, null, lineno);
    }
    var context = 3,
        lines = str.split('\n'),
        start = Math.max(lineno - context, 0),
        end = Math.min(lines.length, lineno + context);
    var context = lines.slice(start, end).map(function(line, i) {
      var curr = i + start + 1;
      return (curr == lineno ? '  > ' : '    ') + curr + '| ' + line;
    }).join('\n');
    err.path = filename;
    err.message = (filename || 'Jade') + ':' + lineno + '\n' + context + '\n\n' + err.message;
    throw err;
  };
  global.define = __define;
  return module.exports;
});



System.register("src/todoItem/index", ["../utils/register"], function (_export) {
  var register;
  return {
    setters: [function (_utilsRegister) {
      register = _utilsRegister["default"];
    }],
    execute: function () {
      "use strict";

      _export("default", register("todoItem", []));
    }
  };
});
System.register("src/providers/Storage", [], function (_export) {
  var _prototypeProperties, _classCallCheck, Storage;

  return {
    setters: [],
    execute: function () {
      "use strict";

      _prototypeProperties = function (child, staticProps, instanceProps) { if (staticProps) Object.defineProperties(child, staticProps); if (instanceProps) Object.defineProperties(child.prototype, instanceProps); };

      _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } };

      Storage = _export("Storage", (function () {
        function Storage() {
          _classCallCheck(this, Storage);

          throw Error("Abstract class");
        }

        _prototypeProperties(Storage, null, {
          add: {
            value: function add() {
              throw Error("add Not implemented");
            },
            writable: true,
            configurable: true
          },
          save: {
            value: function save() {
              throw Error("save Not implemented");
            },
            writable: true,
            configurable: true
          },
          remove: {
            value: function remove(element) {
              throw Error("remove Not implemented");
            },
            writable: true,
            configurable: true
          },
          get: {
            value: function get(element) {
              throw Error("get Not implemented");
            },
            writable: true,
            configurable: true
          },
          getAll: {
            value: function getAll() {
              throw Error("getAll Not implemented");
            },
            writable: true,
            configurable: true
          }
        });

        return Storage;
      })());
    }
  };
});
System.register("src/services/index", ["../utils/register"], function (_export) {
  var register;
  return {
    setters: [function (_utilsRegister) {
      register = _utilsRegister["default"];
    }],
    execute: function () {
      "use strict";

      _export("default", register("services", []));
    }
  };
});
System.register("src/todoList/template.jade!github:johnsoftek/plugin-jade@0.4.0", ["npm:jade@1.9.1/lib/runtime"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  var jade = require('npm:jade@1.9.1/lib/runtime');
  module.exports = function template(locals) {
    var buf = [];
    var jade_mixins = {};
    var jade_interp;
    buf.push("<span>to do list directive content::</span>");
    ;
    return buf.join("");
  };
  global.define = __define;
  return module.exports;
});



System.register("src/providers/LocalStorage", ["./Storage"], function (_export) {
  var Storage, _prototypeProperties, _inherits, _classCallCheck, LocalStorage;

  return {
    setters: [function (_Storage) {
      Storage = _Storage.Storage;
    }],
    execute: function () {
      "use strict";

      _prototypeProperties = function (child, staticProps, instanceProps) { if (staticProps) Object.defineProperties(child, staticProps); if (instanceProps) Object.defineProperties(child.prototype, instanceProps); };

      _inherits = function (subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) subClass.__proto__ = superClass; };

      _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } };

      LocalStorage = (function (Storage) {
        function LocalStorage() {
          _classCallCheck(this, LocalStorage);

          console.log("LocalStorage Initiated");
        }

        _inherits(LocalStorage, Storage);

        _prototypeProperties(LocalStorage, null, {
          add: {
            value: function add() {
              console.log("add");
            },
            writable: true,
            configurable: true
          },
          save: {
            value: function save() {
              console.log("save");
            },
            writable: true,
            configurable: true
          },
          remove: {
            value: function remove(element) {
              console.log("remove");
            },
            writable: true,
            configurable: true
          },
          get: {
            value: function get(element) {
              console.log("get");
            },
            writable: true,
            configurable: true
          },
          getAll: {
            value: function getAll() {
              console.log("getAll");
            },
            writable: true,
            configurable: true
          }
        });

        return LocalStorage;
      })(Storage);

      _export("default", LocalStorage);
    }
  };
});
System.register("src/todoList/TodoListDirective", ["./template.jade!", "./style.css!"], function (_export) {
  var template, _prototypeProperties, _classCallCheck, TodoListDirective;

  return {
    setters: [function (_templateJade) {
      template = _templateJade["default"];
    }, function (_styleCss) {}],
    execute: function () {
      "use strict";

      _prototypeProperties = function (child, staticProps, instanceProps) { if (staticProps) Object.defineProperties(child, staticProps); if (instanceProps) Object.defineProperties(child.prototype, instanceProps); };

      _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } };

      TodoListDirective = (function () {
        function TodoListDirective(localStorage) {
          _classCallCheck(this, TodoListDirective);

          this.restrict = "E";
          this.transclude = true;
          this.template = template;
          this.scope = {
            onChange: "="
          };
        }

        _prototypeProperties(TodoListDirective, null, {
          link: {
            value: function link(scope, element, attrs) {},
            writable: true,
            configurable: true
          },
          controller: {
            value: function controller($scope) {

              this.addElement = function (params) {};
            },
            writable: true,
            configurable: true
          }
        });

        return TodoListDirective;
      })();

      _export("default", TodoListDirective);

      TodoListDirective.$inject = ["localStorage"];
    }
  };
});
System.register("src/providers/index", ["../utils/register", "./LocalStorage"], function (_export) {
	var register, LocalStorage;
	return {
		setters: [function (_utilsRegister) {
			register = _utilsRegister["default"];
		}, function (_LocalStorage) {
			LocalStorage = _LocalStorage["default"];
		}],
		execute: function () {
			"use strict";

			_export("default", register("todo.providers", []).service("localStorage", LocalStorage));
		}
	};
});
System.register("src/todoList/index", ["../utils/register", "./TodoListDirective"], function (_export) {
  var register, TodoListDirective;
  return {
    setters: [function (_utilsRegister) {
      register = _utilsRegister["default"];
    }, function (_TodoListDirective) {
      TodoListDirective = _TodoListDirective["default"];
    }],
    execute: function () {
      "use strict";

      _export("default", register("").directive("todoList", TodoListDirective));

      console.log("directive todoList loaded");
    }
  };
});
System.register("src/Todo", ["./todoList/index", "./todoItem/index", "./providers/index", "./services/index"], function (_export) {
  var TodoList, TodoItem, Providers, Services;
  return {
    setters: [function (_todoListIndex) {
      TodoList = _todoListIndex["default"];
    }, function (_todoItemIndex) {
      TodoItem = _todoItemIndex["default"];
    }, function (_providersIndex) {
      Providers = _providersIndex["default"];
    }, function (_servicesIndex) {
      Services = _servicesIndex["default"];
    }],
    execute: function () {
      "use strict";

      _export("default", angular.module("TodoModules", [Services.name, TodoList.name, TodoItem.name, Providers.name]));

      console.log("ToDoModules loaded");
    }
  };
});
System.register('src/todoList/style.css!github:systemjs/plugin-css@0.1.6', [], false, function() {});
(function(c){var d=document,a='appendChild',i='styleSheet',s=d.createElement('style');s.type='text/css';d.getElementsByTagName('head')[0][a](s);s[i]?s[i].cssText=c:s[a](d.createTextNode(c));})
("body{background:rgba(0,55,197,.49)}");
//# sourceMappingURL=todo-systemjs.js.map