"format register";
(function(global) {

  var defined = {};

  // indexOf polyfill for IE8
  var indexOf = Array.prototype.indexOf || function(item) {
    for (var i = 0, l = this.length; i < l; i++)
      if (this[i] === item)
        return i;
    return -1;
  }

  function dedupe(deps) {
    var newDeps = [];
    for (var i = 0, l = deps.length; i < l; i++)
      if (indexOf.call(newDeps, deps[i]) == -1)
        newDeps.push(deps[i])
    return newDeps;
  }

  function register(name, deps, declare, execute) {
    if (typeof name != 'string')
      throw "System.register provided no module name";
    
    var entry;

    // dynamic
    if (typeof declare == 'boolean') {
      entry = {
        declarative: false,
        deps: deps,
        execute: execute,
        executingRequire: declare
      };
    }
    else {
      // ES6 declarative
      entry = {
        declarative: true,
        deps: deps,
        declare: declare
      };
    }

    entry.name = name;
    
    // we never overwrite an existing define
    if (!defined[name])
      defined[name] = entry; 

    entry.deps = dedupe(entry.deps);

    // we have to normalize dependencies
    // (assume dependencies are normalized for now)
    // entry.normalizedDeps = entry.deps.map(normalize);
    entry.normalizedDeps = entry.deps;
  }

  function buildGroups(entry, groups) {
    groups[entry.groupIndex] = groups[entry.groupIndex] || [];

    if (indexOf.call(groups[entry.groupIndex], entry) != -1)
      return;

    groups[entry.groupIndex].push(entry);

    for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
      var depName = entry.normalizedDeps[i];
      var depEntry = defined[depName];
      
      // not in the registry means already linked / ES6
      if (!depEntry || depEntry.evaluated)
        continue;
      
      // now we know the entry is in our unlinked linkage group
      var depGroupIndex = entry.groupIndex + (depEntry.declarative != entry.declarative);

      // the group index of an entry is always the maximum
      if (depEntry.groupIndex === undefined || depEntry.groupIndex < depGroupIndex) {
        
        // if already in a group, remove from the old group
        if (depEntry.groupIndex !== undefined) {
          groups[depEntry.groupIndex].splice(indexOf.call(groups[depEntry.groupIndex], depEntry), 1);

          // if the old group is empty, then we have a mixed depndency cycle
          if (groups[depEntry.groupIndex].length == 0)
            throw new TypeError("Mixed dependency cycle detected");
        }

        depEntry.groupIndex = depGroupIndex;
      }

      buildGroups(depEntry, groups);
    }
  }

  function link(name) {
    var startEntry = defined[name];

    startEntry.groupIndex = 0;

    var groups = [];

    buildGroups(startEntry, groups);

    var curGroupDeclarative = !!startEntry.declarative == groups.length % 2;
    for (var i = groups.length - 1; i >= 0; i--) {
      var group = groups[i];
      for (var j = 0; j < group.length; j++) {
        var entry = group[j];

        // link each group
        if (curGroupDeclarative)
          linkDeclarativeModule(entry);
        else
          linkDynamicModule(entry);
      }
      curGroupDeclarative = !curGroupDeclarative; 
    }
  }

  // module binding records
  var moduleRecords = {};
  function getOrCreateModuleRecord(name) {
    return moduleRecords[name] || (moduleRecords[name] = {
      name: name,
      dependencies: [],
      exports: {}, // start from an empty module and extend
      importers: []
    })
  }

  function linkDeclarativeModule(entry) {
    // only link if already not already started linking (stops at circular)
    if (entry.module)
      return;

    var module = entry.module = getOrCreateModuleRecord(entry.name);
    var exports = entry.module.exports;

    var declaration = entry.declare.call(global, function(name, value) {
      module.locked = true;
      exports[name] = value;

      for (var i = 0, l = module.importers.length; i < l; i++) {
        var importerModule = module.importers[i];
        if (!importerModule.locked) {
          var importerIndex = indexOf.call(importerModule.dependencies, module);
          importerModule.setters[importerIndex](exports);
        }
      }

      module.locked = false;
      return value;
    });
    
    module.setters = declaration.setters;
    module.execute = declaration.execute;

    if (!module.setters || !module.execute)
      throw new TypeError("Invalid System.register form for " + entry.name);

    // now link all the module dependencies
    for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
      var depName = entry.normalizedDeps[i];
      var depEntry = defined[depName];
      var depModule = moduleRecords[depName];

      // work out how to set depExports based on scenarios...
      var depExports;

      if (depModule) {
        depExports = depModule.exports;
      }
      else if (depEntry && !depEntry.declarative) {
        depExports = { 'default': depEntry.module.exports, __useDefault: true };
      }
      // in the module registry
      else if (!depEntry) {
        depExports = load(depName);
      }
      // we have an entry -> link
      else {
        linkDeclarativeModule(depEntry);
        depModule = depEntry.module;
        depExports = depModule.exports;
      }

      // only declarative modules have dynamic bindings
      if (depModule && depModule.importers) {
        depModule.importers.push(module);
        module.dependencies.push(depModule);
      }
      else
        module.dependencies.push(null);

      // run the setter for this dependency
      if (module.setters[i])
        module.setters[i](depExports);
    }
  }

  // An analog to loader.get covering execution of all three layers (real declarative, simulated declarative, simulated dynamic)
  function getModule(name) {
    var exports;
    var entry = defined[name];

    if (!entry) {
      exports = load(name);
      if (!exports)
        throw new Error("Unable to load dependency " + name + ".");
    }

    else {
      if (entry.declarative)
        ensureEvaluated(name, []);
    
      else if (!entry.evaluated)
        linkDynamicModule(entry);

      exports = entry.module.exports;
    }

    if ((!entry || entry.declarative) && exports && exports.__useDefault)
      return exports['default'];

    return exports;
  }

  function linkDynamicModule(entry) {
    if (entry.module)
      return;

    var exports = {};

    var module = entry.module = { exports: exports, id: entry.name };

    // AMD requires execute the tree first
    if (!entry.executingRequire) {
      for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
        var depName = entry.normalizedDeps[i];
        var depEntry = defined[depName];
        if (depEntry)
          linkDynamicModule(depEntry);
      }
    }

    // now execute
    entry.evaluated = true;
    var output = entry.execute.call(global, function(name) {
      for (var i = 0, l = entry.deps.length; i < l; i++) {
        if (entry.deps[i] != name)
          continue;
        return getModule(entry.normalizedDeps[i]);
      }
      throw new TypeError('Module ' + name + ' not declared as a dependency.');
    }, exports, module);
    
    if (output)
      module.exports = output;
  }

  /*
   * Given a module, and the list of modules for this current branch,
   *  ensure that each of the dependencies of this module is evaluated
   *  (unless one is a circular dependency already in the list of seen
   *  modules, in which case we execute it)
   *
   * Then we evaluate the module itself depth-first left to right 
   * execution to match ES6 modules
   */
  function ensureEvaluated(moduleName, seen) {
    var entry = defined[moduleName];

    // if already seen, that means it's an already-evaluated non circular dependency
    if (entry.evaluated || !entry.declarative)
      return;

    // this only applies to declarative modules which late-execute

    seen.push(moduleName);

    for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
      var depName = entry.normalizedDeps[i];
      if (indexOf.call(seen, depName) == -1) {
        if (!defined[depName])
          load(depName);
        else
          ensureEvaluated(depName, seen);
      }
    }

    if (entry.evaluated)
      return;

    entry.evaluated = true;
    entry.module.execute.call(global);
  }

  // magical execution function
  var modules = {};
  function load(name) {
    if (modules[name])
      return modules[name];

    var entry = defined[name];

    // first we check if this module has already been defined in the registry
    if (!entry)
      throw "Module " + name + " not present.";

    // recursively ensure that the module and all its 
    // dependencies are linked (with dependency group handling)
    link(name);

    // now handle dependency execution in correct order
    ensureEvaluated(name, []);

    // remove from the registry
    defined[name] = undefined;

    var module = entry.declarative ? entry.module.exports : { 'default': entry.module.exports, '__useDefault': true };

    // return the defined module object
    return modules[name] = module;
  };

  return function(main, declare) {

    var System;

    // if there's a system loader, define onto it
    if (typeof System != 'undefined' && System.register) {
      declare(System);
      System['import'](main);
    }
    // otherwise, self execute
    else {
      declare(System = {
        register: register, 
        get: load, 
        set: function(name, module) {
          modules[name] = module; 
        },
        newModule: function(module) {
          return module;
        },
        global: global 
      });
      System.set('@empty', System.newModule({}));
      load(main);
    }
  };

})(typeof window != 'undefined' ? window : global)
/* ('mainModule', function(System) {
  System.register(...);
}); */

('src/Todo', function(System) {


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
      str = str || require("@empty").readFileSync(filename, 'utf8');
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



System.register("src/todoItem/index", ["src/utils/register"], function (_export) {
  var register;
  return {
    setters: [function (_srcUtilsRegister) {
      register = _srcUtilsRegister["default"];
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
System.register("src/services/index", ["src/utils/register"], function (_export) {
  var register;
  return {
    setters: [function (_srcUtilsRegister) {
      register = _srcUtilsRegister["default"];
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
  var jade = require("npm:jade@1.9.1/lib/runtime");
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



System.register("src/providers/LocalStorage", ["src/providers/Storage"], function (_export) {
  var Storage, _prototypeProperties, _inherits, _classCallCheck, LocalStorage;

  return {
    setters: [function (_srcProvidersStorage) {
      Storage = _srcProvidersStorage.Storage;
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
System.register("src/todoList/TodoListDirective", ["src/todoList/template.jade!github:johnsoftek/plugin-jade@0.4.0", "src/todoList/style.css!github:systemjs/plugin-css@0.1.6"], function (_export) {
  var template, _prototypeProperties, _classCallCheck, TodoListDirective;

  return {
    setters: [function (_srcTodoListTemplateJadeGithubJohnsoftekPluginJade040) {
      template = _srcTodoListTemplateJadeGithubJohnsoftekPluginJade040["default"];
    }, function (_srcTodoListStyleCssGithubSystemjsPluginCss016) {}],
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
System.register("src/providers/index", ["src/utils/register", "src/providers/LocalStorage"], function (_export) {
	var register, LocalStorage;
	return {
		setters: [function (_srcUtilsRegister) {
			register = _srcUtilsRegister["default"];
		}, function (_srcProvidersLocalStorage) {
			LocalStorage = _srcProvidersLocalStorage["default"];
		}],
		execute: function () {
			"use strict";

			_export("default", register("todo.providers", []).service("localStorage", LocalStorage));
		}
	};
});
System.register("src/todoList/index", ["src/utils/register", "src/todoList/TodoListDirective"], function (_export) {
  var register, TodoListDirective;
  return {
    setters: [function (_srcUtilsRegister) {
      register = _srcUtilsRegister["default"];
    }, function (_srcTodoListTodoListDirective) {
      TodoListDirective = _srcTodoListTodoListDirective["default"];
    }],
    execute: function () {
      "use strict";

      _export("default", register("").directive("todoList", TodoListDirective));

      console.log("directive todoList loaded");
    }
  };
});
System.register("src/Todo", ["src/todoList/index", "src/todoItem/index", "src/providers/index", "src/services/index"], function (_export) {
  var TodoList, TodoItem, Providers, Services;
  return {
    setters: [function (_srcTodoListIndex) {
      TodoList = _srcTodoListIndex["default"];
    }, function (_srcTodoItemIndex) {
      TodoItem = _srcTodoItemIndex["default"];
    }, function (_srcProvidersIndex) {
      Providers = _srcProvidersIndex["default"];
    }, function (_srcServicesIndex) {
      Services = _srcServicesIndex["default"];
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
});
//# sourceMappingURL=todo.js.map