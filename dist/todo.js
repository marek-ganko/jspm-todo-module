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



System.register("npm:todomvc-common@1.0.1/base", [], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  "format cjs";
  (function() {
    'use strict';
    var _ = (function(_) {
      _.defaults = function(object) {
        if (!object) {
          return object;
        }
        for (var argsIndex = 1,
            argsLength = arguments.length; argsIndex < argsLength; argsIndex++) {
          var iterable = arguments[argsIndex];
          if (iterable) {
            for (var key in iterable) {
              if (object[key] == null) {
                object[key] = iterable[key];
              }
            }
          }
        }
        return object;
      };
      _.templateSettings = {
        evaluate: /<%([\s\S]+?)%>/g,
        interpolate: /<%=([\s\S]+?)%>/g,
        escape: /<%-([\s\S]+?)%>/g
      };
      var noMatch = /(.)^/;
      var escapes = {
        "'": "'",
        '\\': '\\',
        '\r': 'r',
        '\n': 'n',
        '\t': 't',
        '\u2028': 'u2028',
        '\u2029': 'u2029'
      };
      var escaper = /\\|'|\r|\n|\t|\u2028|\u2029/g;
      _.template = function(text, data, settings) {
        var render;
        settings = _.defaults({}, settings, _.templateSettings);
        var matcher = new RegExp([(settings.escape || noMatch).source, (settings.interpolate || noMatch).source, (settings.evaluate || noMatch).source].join('|') + '|$', 'g');
        var index = 0;
        var source = "__p+='";
        text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
          source += text.slice(index, offset).replace(escaper, function(match) {
            return '\\' + escapes[match];
          });
          if (escape) {
            source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
          }
          if (interpolate) {
            source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
          }
          if (evaluate) {
            source += "';\n" + evaluate + "\n__p+='";
          }
          index = offset + match.length;
          return match;
        });
        source += "';\n";
        if (!settings.variable)
          source = 'with(obj||{}){\n' + source + '}\n';
        source = "var __t,__p='',__j=Array.prototype.join," + "print=function(){__p+=__j.call(arguments,'');};\n" + source + "return __p;\n";
        try {
          render = new Function(settings.variable || 'obj', '_', source);
        } catch (e) {
          e.source = source;
          throw e;
        }
        if (data)
          return render(data, _);
        var template = function(data) {
          return render.call(this, data, _);
        };
        template.source = 'function(' + (settings.variable || 'obj') + '){\n' + source + '}';
        return template;
      };
      return _;
    })({});
    if (location.hostname === 'todomvc.com') {
      window._gaq = [['_setAccount', 'UA-31081062-1'], ['_trackPageview']];
      (function(d, t) {
        var g = d.createElement(t),
            s = d.getElementsByTagName(t)[0];
        g.src = '//www.google-analytics.com/ga.js';
        s.parentNode.insertBefore(g, s);
      }(document, 'script'));
    }
    function redirect() {
      if (location.hostname === 'tastejs.github.io') {
        location.href = location.href.replace('tastejs.github.io/todomvc', 'todomvc.com');
      }
    }
    function findRoot() {
      var base = location.href.indexOf('examples/');
      return location.href.substr(0, base);
    }
    function getFile(file, callback) {
      if (!location.host) {
        return console.info('Miss the info bar? Run TodoMVC from a server to avoid a cross-origin error.');
      }
      var xhr = new XMLHttpRequest();
      xhr.open('GET', findRoot() + file, true);
      xhr.send();
      xhr.onload = function() {
        if (xhr.status === 200 && callback) {
          callback(xhr.responseText);
        }
      };
    }
    function Learn(learnJSON, config) {
      if (!(this instanceof Learn)) {
        return new Learn(learnJSON, config);
      }
      var template,
          framework;
      if (typeof learnJSON !== 'object') {
        try {
          learnJSON = JSON.parse(learnJSON);
        } catch (e) {
          return ;
        }
      }
      if (config) {
        template = config.template;
        framework = config.framework;
      }
      if (!template && learnJSON.templates) {
        template = learnJSON.templates.todomvc;
      }
      if (!framework && document.querySelector('[data-framework]')) {
        framework = document.querySelector('[data-framework]').dataset.framework;
      }
      this.template = template;
      if (learnJSON.backend) {
        this.frameworkJSON = learnJSON.backend;
        this.frameworkJSON.issueLabel = framework;
        this.append({backend: true});
      } else if (learnJSON[framework]) {
        this.frameworkJSON = learnJSON[framework];
        this.frameworkJSON.issueLabel = framework;
        this.append();
      }
      this.fetchIssueCount();
    }
    Learn.prototype.append = function(opts) {
      var aside = document.createElement('aside');
      aside.innerHTML = _.template(this.template, this.frameworkJSON);
      aside.className = 'learn';
      if (opts && opts.backend) {
        var sourceLinks = aside.querySelector('.source-links');
        var heading = sourceLinks.firstElementChild;
        var sourceLink = sourceLinks.lastElementChild;
        var href = sourceLink.getAttribute('href');
        sourceLink.setAttribute('href', href.substr(href.lastIndexOf('http')));
        sourceLinks.innerHTML = heading.outerHTML + sourceLink.outerHTML;
      } else {
        var demoLinks = aside.querySelectorAll('.demo-link');
        Array.prototype.forEach.call(demoLinks, function(demoLink) {
          if (demoLink.getAttribute('href').substr(0, 4) !== 'http') {
            demoLink.setAttribute('href', findRoot() + demoLink.getAttribute('href'));
          }
        });
      }
      document.body.className = (document.body.className + ' learn-bar').trim();
      document.body.insertAdjacentHTML('afterBegin', aside.outerHTML);
    };
    Learn.prototype.fetchIssueCount = function() {
      var issueLink = document.getElementById('issue-count-link');
      if (issueLink) {
        var url = issueLink.href.replace('https://github.com', 'https://api.github.com/repos');
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.onload = function(e) {
          var parsedResponse = JSON.parse(e.target.responseText);
          if (parsedResponse instanceof Array) {
            var count = parsedResponse.length;
            if (count !== 0) {
              issueLink.innerHTML = 'This app has ' + count + ' open issues';
              document.getElementById('issue-count').style.display = 'inline';
            }
          }
        };
        xhr.send();
      }
    };
    redirect();
    getFile('learn.json', Learn);
  })();
  global.define = __define;
  return module.exports;
});



System.register("github:angular/bower-angular@1.3.15", [], function (_export) {
  var angular;
  return {
    setters: [],
    execute: function () {
      "use strict";
      angular = window.angular;

      _export("default", angular);
    }
  };
});
System.register("src/services/storage/Storage", ["github:angular/bower-angular@1.3.15"], function (_export) {
  var angular, _createClass, _classCallCheck, Storage;

  return {
    setters: [function (_githubAngularBowerAngular1315) {
      angular = _githubAngularBowerAngular1315["default"];
    }],
    execute: function () {
      "use strict";

      _createClass = (function () { function defineProperties(target, props) { for (var key in props) { var prop = props[key]; prop.configurable = true; if (prop.value) prop.writable = true; } Object.defineProperties(target, props); } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

      _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } };

      Storage = _export("Storage", (function () {
        function Storage() {
          _classCallCheck(this, Storage);

          this.items = [];
        }

        _createClass(Storage, {
          add: {

            /**
             * @param {*} item
             * @returns {Promise}
             */

            value: function add(item) {
              var _this = this;

              return new Promise(function (resolve, reject) {
                _this.items.push(item);
                _this.saveOnStorage(_this.items).then(function (items) {
                  resolve(items);
                });
              });
            }
          },
          save: {

            /**
             * @param item
             * @returns {Promise}
             */

            value: function save(item) {
              var _this = this;

              return new Promise(function (resolve, reject) {
                _this.items[_this.items.indexOf(item)] = item;
                _this.saveOnStorage(_this.items).then(function (items) {
                  resolve(items);
                });
              });
            }
          },
          remove: {

            /**
             * @param item
             * @returns {Promise}
             */

            value: function remove(item) {
              var _this = this;

              return new Promise(function (resolve, reject) {
                _this.items.splice(_this.items.indexOf(item), 1);
                _this.saveOnStorage(_this.items).then(function (items) {
                  resolve(items);
                });
              });
            }
          },
          get: {

            /**
             * @returns {*}
             */

            value: function get() {
              this.items = this.getFromStorage();
              return this.items;
            }
          },
          filter: {
            value: function filter(callback) {
              var _this = this;

              return new Promise(function (resolve, reject) {
                var incompleteTodos = _this.items.filter(callback);
                angular.copy(incompleteTodos, _this.items);
                _this.saveOnStorage(_this.items).then(function (items) {
                  resolve(items);
                });
              });
            }
          },
          getFromStorage: {
            value: function getFromStorage() {
              throw new Error("getFromStorage Not implemented");
            }
          },
          saveOnStorage: {
            value: function saveOnStorage(items) {
              throw new Error("saveOnStorage Not implemented");
            }
          }
        });

        return Storage;
      })());
    }
  };
});
System.register("src/services/storage/CookieStorage", ["src/services/storage/Storage"], function (_export) {
  var Storage, _createClass, _get, _inherits, _classCallCheck, STORAGE_ID, CookieStorage;

  return {
    setters: [function (_srcServicesStorageStorage) {
      Storage = _srcServicesStorageStorage.Storage;
    }],
    execute: function () {
      "use strict";

      _createClass = (function () { function defineProperties(target, props) { for (var key in props) { var prop = props[key]; prop.configurable = true; if (prop.value) prop.writable = true; } Object.defineProperties(target, props); } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

      _get = function get(object, property, receiver) { var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc && desc.writable) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

      _inherits = function (subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) subClass.__proto__ = superClass; };

      _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } };

      STORAGE_ID = "todo-module";

      CookieStorage = (function (_Storage) {
        function CookieStorage() {
          _classCallCheck(this, CookieStorage);

          _get(Object.getPrototypeOf(CookieStorage.prototype), "constructor", this).call(this, this);
        }

        _inherits(CookieStorage, _Storage);

        _createClass(CookieStorage, {
          getFromStorage: {

            /**
             * @returns {Array}
             */

            value: function getFromStorage() {
              var result = document.cookie.match(new RegExp(STORAGE_ID + "=([^;]+)"));
              result = result && JSON.parse(result[1]);
              return result || [];
            }
          },
          saveOnStorage: {

            /**
             * @returns {Promise}
             */

            value: function saveOnStorage(items) {
              return new Promise(function (resolve, reject) {
                document.cookie = STORAGE_ID + "=" + JSON.stringify(items);
                resolve(items);
              });
            }
          }
        });

        return CookieStorage;
      })(Storage);

      _export("default", CookieStorage);
    }
  };
});
System.register("src/todo/template.jade!github:johnsoftek/plugin-jade@0.4.0", ["npm:jade@1.9.1/lib/runtime"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  var jade = require("npm:jade@1.9.1/lib/runtime");
  module.exports = function template(locals) {
    var buf = [];
    var jade_mixins = {};
    var jade_interp;
    buf.push("<section id=\"todoapp\"><header id=\"header\"><h1>todos</h1><form id=\"todo-form\" ng-submit=\"addTodo()\"><input id=\"new-todo\" placeholder=\"What needs to be done?\" href=\"#\" ng-model=\"newTodo\" autofocus=\"\"/></form></header><section id=\"main\" ng-show=\"todos.length\" ng-cloak=\"\"><input id=\"toggle-all\" type=\"checkbox\" ng-model=\"allChecked\" href=\"#\" ng-click=\"markAll(allChecked)\"/><label for=\"toggle-all\">Mark all as complete</label><ul id=\"todo-list\"><li ng-repeat=\"todo in todos | filter:statusFilter track by $index\" href=\"#\" ng-class=\"{completed: todo.completed, editing: todo === editedTodo}\"><div class=\"view\"><input type=\"checkbox\" ng-model=\"todo.completed\" ng-change=\"toggleCompleted(todo)\" class=\"toggle\"/><label ng-dblclick=\"editTodo(todo)\">{{todo.title}}</label><button ng-click=\"removeTodo(todo)\" class=\"destroy\"></button></div><form ng-submit=\"saveEdits(todo, 'submit')\"><input ng-trim=\"false\" ng-model=\"todo.title\" todo-escape=\"revertEdits(todo)\" ng-blur=\"saveEdits(todo, 'blur')\" todo-focus=\"todo == editedTodo\" class=\"edit\"/></form></li></ul></section><footer id=\"footer\" ng-show=\"todos.length\" ng-cloak=\"\"><span id=\"todo-count\"><strong>{{remainingCount}}</strong><ng-pluralize count=\"remainingCount\" when=\"{ one: 'item left', other: 'items left' }\"></ng-pluralize></span><ul id=\"filters\"><li><a ng-class=\"{selected: status == ''}\" href=\"#\" ng-click=\"onStatusChange('')\">All</a></li><li><a ng-class=\"{selected: status == 'active'}\" href=\"#\" ng-click=\"onStatusChange('active')\">Active</a></li><li><a ng-class=\"{selected: status == 'completed'}\" href=\"#\" ng-click=\"onStatusChange('completed')\">Completed</a></li></ul><button id=\"clear-completed\" ng-click=\"clearCompletedTodos()\" href=\"#\" ng-show=\"completedCount\">Clear completed ({{completedCount}})</button></footer></section><footer id=\"info\"><p>Double-click to edit a todo</p><p>Credits:<a href=\"http://twitter.com/cburgdorf\">Christoph Burgdorf</a>,<a href=\"http://ericbidelman.com\">Eric Bidelman</a>,<a href=\"http://jacobmumm.com\">Jacob Mumm</a> and<a href=\"http://igorminar.com\">Igor Minar</a></p><p>Part of<a href=\"http://todomvc.com\">TodoMVC</a></p></footer>");
    ;
    return buf.join("");
  };
  global.define = __define;
  return module.exports;
});



System.register("npm:todomvc-common@1.0.1", ["npm:todomvc-common@1.0.1/base"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  module.exports = require("npm:todomvc-common@1.0.1/base");
  global.define = __define;
  return module.exports;
});



System.register("src/todo/module", ["github:angular/bower-angular@1.3.15"], function (_export) {
  var angular;
  return {
    setters: [function (_githubAngularBowerAngular1315) {
      angular = _githubAngularBowerAngular1315["default"];
    }],
    execute: function () {
      "use strict";

      _export("default", angular.module("todoModule", []));
    }
  };
});
System.register("src/services/storage/LocalStorage", ["src/services/storage/Storage"], function (_export) {
  var Storage, _createClass, _get, _inherits, _classCallCheck, STORAGE_ID, LocalStorage;

  return {
    setters: [function (_srcServicesStorageStorage) {
      Storage = _srcServicesStorageStorage.Storage;
    }],
    execute: function () {
      "use strict";

      _createClass = (function () { function defineProperties(target, props) { for (var key in props) { var prop = props[key]; prop.configurable = true; if (prop.value) prop.writable = true; } Object.defineProperties(target, props); } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

      _get = function get(object, property, receiver) { var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc && desc.writable) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

      _inherits = function (subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) subClass.__proto__ = superClass; };

      _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } };

      STORAGE_ID = "todo-module";

      LocalStorage = (function (_Storage) {
        function LocalStorage() {
          _classCallCheck(this, LocalStorage);

          _get(Object.getPrototypeOf(LocalStorage.prototype), "constructor", this).call(this, this);
        }

        _inherits(LocalStorage, _Storage);

        _createClass(LocalStorage, {
          getFromStorage: {

            /**
             * @returns {Array}
             */

            value: function getFromStorage() {
              return JSON.parse(localStorage.getItem(STORAGE_ID) || "[]");
            }
          },
          saveOnStorage: {

            /**
             * @returns {Promise}
             */

            value: function saveOnStorage(items) {
              return new Promise(function (resolve, reject) {
                localStorage.setItem(STORAGE_ID, JSON.stringify(items));
                resolve(items);
              });
            }
          }
        });

        return LocalStorage;
      })(Storage);

      _export("default", LocalStorage);
    }
  };
});
System.register("src/todo/TodoDirective", ["src/todo/template.jade!github:johnsoftek/plugin-jade@0.4.0", "npm:todomvc-common@1.0.1", "npm:todomvc-common@1.0.1/base.css!github:systemjs/plugin-css@0.1.9", "npm:todomvc-app-css@1.0.1/index.css!github:systemjs/plugin-css@0.1.9", "src/todo/style.css!github:systemjs/plugin-css@0.1.9", "src/todo/module", "github:angular/bower-angular@1.3.15"], function (_export) {
  var template, todoModule, angular;
  return {
    setters: [function (_srcTodoTemplateJadeGithubJohnsoftekPluginJade040) {
      template = _srcTodoTemplateJadeGithubJohnsoftekPluginJade040["default"];
    }, function (_npmTodomvcCommon101) {}, function (_npmTodomvcCommon101BaseCssGithubSystemjsPluginCss019) {}, function (_npmTodomvcAppCss101IndexCssGithubSystemjsPluginCss019) {}, function (_srcTodoStyleCssGithubSystemjsPluginCss019) {}, function (_srcTodoModule) {
      todoModule = _srcTodoModule["default"];
    }, function (_githubAngularBowerAngular1315) {
      angular = _githubAngularBowerAngular1315["default"];
    }],
    execute: function () {
      "use strict";

      todoModule.directive("todo", function (StorageFactory) {
        return {
          restrict: "E",
          template: template,
          scope: {
            storage: "@"
          },

          controller: function ($scope, $filter) {

            var storage = new StorageFactory($scope.storage).get();
            var todos = $scope.todos = storage.get();
            $scope.newTodo = "";
            $scope.editedTodo = null;

            $scope.$watch("todos", function () {
              $scope.remainingCount = $filter("filter")(todos, { completed: false }).length;
              $scope.completedCount = todos.length - $scope.remainingCount;
              $scope.allChecked = !$scope.remainingCount;
            }, true);

            $scope.onStatusChange = function (status) {
              $scope.statusFilter = status === "active" ? { completed: false } : status === "completed" ? { completed: true } : {};
            };

            $scope.addTodo = function () {
              if (!$scope.newTodo) {
                return;
              }
              var newTodo = {
                title: $scope.newTodo.trim(),
                completed: false
              };

              storage.add(newTodo).then(function success() {
                $scope.newTodo = null;
                $scope.$apply();
              });
            };

            $scope.editTodo = function (todo) {
              $scope.editedTodo = todo;
              $scope.originalTodo = angular.extend({}, todo);
            };

            $scope.saveEdits = function (todo, event) {
              if (event === "blur" && $scope.saveEvent === "submit") {
                $scope.saveEvent = null;
                return;
              }

              $scope.saveEvent = event;

              if ($scope.reverted) {
                $scope.reverted = null;
                return;
              }

              todo.title = todo.title.trim();

              if (todo.title === $scope.originalTodo.title) {
                $scope.editedTodo = null;
                return;
              }

              storage.save(todo)["catch"](function () {
                todo.title = $scope.originalTodo.title;
              }).then(function () {
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
              storage.remove(todo);
            };

            $scope.toggleCompleted = function (todo) {
              storage.save(todo)["catch"](function (error) {
                throw error;
              });
            };

            $scope.clearCompletedTodos = function () {
              storage.filter(function (todo) {
                return !todo.completed;
              });
            };

            $scope.markAll = function (completed) {
              todos.forEach(function (todo) {
                if (todo.completed !== completed) {
                  todo.completed = !todo.completed;
                  $scope.toggleCompleted(todo);
                }
              });
            };
          }
        };
      });
    }
  };
});
System.register("src/services/StorageFactory", ["src/services/storage/LocalStorage", "src/services/storage/CookieStorage"], function (_export) {
  var LocalStorage, CookieStorage, _createClass, _classCallCheck, StorageFactory;

  return {
    setters: [function (_srcServicesStorageLocalStorage) {
      LocalStorage = _srcServicesStorageLocalStorage["default"];
    }, function (_srcServicesStorageCookieStorage) {
      CookieStorage = _srcServicesStorageCookieStorage["default"];
    }],
    execute: function () {
      "use strict";

      _createClass = (function () { function defineProperties(target, props) { for (var key in props) { var prop = props[key]; prop.configurable = true; if (prop.value) prop.writable = true; } Object.defineProperties(target, props); } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

      _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } };

      StorageFactory = (function () {
        function StorageFactory() {
          var storageType = arguments[0] === undefined ? "localStorage" : arguments[0];

          _classCallCheck(this, StorageFactory);

          switch (storageType) {
            case "localStorage":
              this.storage = new LocalStorage();
              break;
            case "cookies":
              this.storage = new CookieStorage();
              break;
            default:
              throw new Error("Unknown storage type: " + storageType);
          }
        }

        _createClass(StorageFactory, {
          get: {
            value: function get() {
              return this.storage;
            }
          }
        });

        return StorageFactory;
      })();

      _export("default", StorageFactory);
    }
  };
});
System.register("src/todo/index", ["src/todo/TodoDirective"], function (_export) {
  return {
    setters: [function (_srcTodoTodoDirective) {}],
    execute: function () {
      "use strict";
    }
  };
});
System.register("src/services/index", ["src/services/StorageFactory", "github:angular/bower-angular@1.3.15"], function (_export) {
  var StorageFactory, angular, _createClass, _classCallCheck, ExampleService, ExampleFactory;

  return {
    setters: [function (_srcServicesStorageFactory) {
      StorageFactory = _srcServicesStorageFactory["default"];
    }, function (_githubAngularBowerAngular1315) {
      angular = _githubAngularBowerAngular1315["default"];
    }],
    execute: function () {
      "use strict";

      _createClass = (function () { function defineProperties(target, props) { for (var key in props) { var prop = props[key]; prop.configurable = true; if (prop.value) prop.writable = true; } Object.defineProperties(target, props); } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

      _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } };

      ExampleService = (function () {
        function ExampleService($http) {
          _classCallCheck(this, ExampleService);

          this.$http = $http;
        }

        _createClass(ExampleService, {
          getSomeContent: {
            value: function getSomeContent() {
              this.$http.get("src/Todo.js").then(function (Todo) {
                console.info(Todo);
              });
            }
          }
        });

        return ExampleService;
      })();

      ExampleFactory = (function () {
        function ExampleFactory($http) {
          _classCallCheck(this, ExampleFactory);

          this.$http = $http;
        }

        _createClass(ExampleFactory, {
          getSomeContent: {
            value: function getSomeContent() {
              this.$http.get("src/Todo.js").then(function (Todo) {
                console.info(Todo);
              });
            }
          },
          getContentInjector: {
            value: function getContentInjector($http) {
              this.$http.get("src/Todo.js").then(function (Todo) {
                console.info(Todo);
              });
            }
          }
        });

        return ExampleFactory;
      })();

      _export("default", angular.module("todo.services", []).factory("StorageFactory", function () {
        return StorageFactory;
      }).service("exampleService", ExampleService).factory("exampleFactory", function ($http) {
        return new ExampleFactory($http);
      }));
    }
  };
});
System.register("src/Todo", ["src/todo/index", "src/todo/module", "src/services/index", "github:angular/bower-angular@1.3.15"], function (_export) {
  var TodoModule, Services, angular;
  return {
    setters: [function (_srcTodoIndex) {}, function (_srcTodoModule) {
      TodoModule = _srcTodoModule["default"];
    }, function (_srcServicesIndex) {
      Services = _srcServicesIndex["default"];
    }, function (_githubAngularBowerAngular1315) {
      angular = _githubAngularBowerAngular1315["default"];
    }],
    execute: function () {
      "use strict";

      _export("default", angular.module("todoModules", [Services.name, TodoModule.name]));
    }
  };
});
System.register('npm:todomvc-common@1.0.1/base.css!github:systemjs/plugin-css@0.1.9', [], false, function() {});
System.register('npm:todomvc-app-css@1.0.1/index.css!github:systemjs/plugin-css@0.1.9', [], false, function() {});
System.register('src/todo/style.css!github:systemjs/plugin-css@0.1.9', [], false, function() {});
(function(c){var d=document,a='appendChild',i='styleSheet',s=d.createElement('style');s.type='text/css';d.getElementsByTagName('head')[0][a](s);s[i]?s[i].cssText=c:s[a](d.createTextNode(c));})
(".quote p:after,.quote p:before{font-size:50px;position:absolute}#issue-count,.hidden,label[for=toggle-all]{display:none}#todo-list li .toggle,button{-webkit-appearance:none;-ms-appearance:none}#footer,#todoapp h1,#toggle-all{text-align:center}hr{margin:20px 0;border:0;border-top:1px dashed #c5c5c5;border-bottom:1px dashed #f7f7f7}.learn a{font-weight:400;text-decoration:none;color:#b83f45}.learn a:hover{text-decoration:underline;color:#787e7e}.learn h3,.learn h4,.learn h5{margin:10px 0;font-weight:500;line-height:1.2;color:#000}.learn h3{font-size:24px}.learn h4{font-size:18px}.learn h5{margin-bottom:0;font-size:14px}.learn ul{padding:0;margin:0 0 30px 25px}.learn li{line-height:20px}.learn p{font-size:15px;font-weight:300;line-height:1.3;margin-top:0;margin-bottom:0}.quote{border:none;margin:20px 0 60px 0}.quote p{font-style:italic}.quote p:before{content:'“';opacity:.15;top:-20px;left:3px}.quote p:after{content:'”';opacity:.15;bottom:-42px;right:3px}.quote footer{position:absolute;bottom:-40px;right:0}.quote footer img{border-radius:3px}.quote footer a{margin-left:5px;vertical-align:middle}body,button,html{padding:0;margin:0}.speech-bubble{position:relative;padding:10px;background:rgba(0,0,0,.04);border-radius:5px}.speech-bubble:after{content:'';position:absolute;top:100%;right:30px;border:13px solid transparent;border-top-color:rgba(0,0,0,.04)}#footer,#main{border-top:1px solid #e6e6e6}.learn-bar>.learn{position:absolute;width:272px;top:8px;left:-300px;padding:10px;border-radius:5px;background-color:rgba(255,255,255,.6);transition-property:left;transition-duration:500ms}@media (min-width:899px){.learn-bar{width:auto;padding-left:300px}.learn-bar>.learn{left:8px}}button{border:0;background:0 0;font-size:100%;vertical-align:baseline;font-family:inherit;font-weight:inherit;color:inherit;appearance:none;-webkit-font-smoothing:antialiased;-moz-font-smoothing:antialiased;-ms-font-smoothing:antialiased;font-smoothing:antialiased}body{font:14px 'Helvetica Neue',Helvetica,Arial,sans-serif;line-height:1.4em;color:#4d4d4d;min-width:230px;max-width:550px;margin:0 auto;-webkit-font-smoothing:antialiased;-moz-font-smoothing:antialiased;-ms-font-smoothing:antialiased;font-smoothing:antialiased;font-weight:300}button,input[type=checkbox]{outline:0}#todoapp{background:#fff;margin:130px 0 40px 0;position:relative;box-shadow:0 2px 4px 0 rgba(0,0,0,.2),0 25px 50px 0 rgba(0,0,0,.1)}#todoapp input::-webkit-input-placeholder{font-style:italic;font-weight:300;color:#e6e6e6}#todoapp input::-moz-placeholder{font-style:italic;font-weight:300;color:#e6e6e6}#todoapp input::input-placeholder{font-style:italic;font-weight:300;color:#e6e6e6}#todoapp h1{position:absolute;top:-155px;width:100%;font-size:100px;font-weight:100;color:rgba(175,47,47,.15);-webkit-text-rendering:optimizeLegibility;-moz-text-rendering:optimizeLegibility;-ms-text-rendering:optimizeLegibility;text-rendering:optimizeLegibility}#new-todo,.edit{position:relative;margin:0;width:100%;font-size:24px;font-family:inherit;font-weight:inherit;line-height:1.4em;outline:0;color:inherit;padding:6px;border:1px solid #999;box-shadow:inset 0 -1px 5px 0 rgba(0,0,0,.2);-ms-box-sizing:border-box;box-sizing:border-box;-webkit-font-smoothing:antialiased;-moz-font-smoothing:antialiased;-ms-font-smoothing:antialiased;font-smoothing:antialiased}#new-todo{padding:16px 16px 16px 60px;border:none;background:rgba(0,0,0,.003);box-shadow:inset 0 -2px 1px rgba(0,0,0,.03)}#main{position:relative;z-index:2}#toggle-all{position:absolute;top:-55px;left:-12px;width:60px;height:34px;border:none}#toggle-all:before{content:'❯';font-size:22px;color:#e6e6e6;padding:10px 27px 10px 27px}#toggle-all:checked:before{color:#737373}#todo-list{margin:0;padding:0;list-style:none}#todo-list li{position:relative;font-size:24px;border-bottom:1px solid #ededed}#todo-list li:last-child{border-bottom:none}#todo-list li.editing{border-bottom:none;padding:0}#todo-list li.editing .edit{display:block;width:506px;padding:13px 17px 12px 17px;margin:0 0 0 43px}#todo-list li.editing .view{display:none}#todo-list li .toggle{text-align:center;width:40px;height:auto;position:absolute;top:0;bottom:0;margin:auto 0;border:none;appearance:none}#todo-list li .toggle:after{content:url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"40\" height=\"40\" viewBox=\"-10 -18 100 135\"><circle cx=\"50\" cy=\"50\" r=\"50\" fill=\"none\" stroke=\"#ededed\" stroke-width=\"3\"/></svg>')}#todo-list li .toggle:checked:after{content:url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"40\" height=\"40\" viewBox=\"-10 -18 100 135\"><circle cx=\"50\" cy=\"50\" r=\"50\" fill=\"none\" stroke=\"#bddad5\" stroke-width=\"3\"/><path fill=\"#5dc2af\" d=\"M72 25L42 71 27 56l-4 4 20 20 34-52z\"/></svg>')}#todo-list li label{white-space:pre;word-break:break-word;padding:15px 60px 15px 15px;margin-left:45px;display:block;line-height:1.2;transition:color .4s}#todo-list li.completed label{color:#d9d9d9;text-decoration:line-through}#todo-list li .destroy{display:none;position:absolute;top:0;right:10px;bottom:0;width:40px;height:40px;margin:auto 0;font-size:30px;color:#cc9a9a;margin-bottom:11px;transition:color .2s ease-out}#todo-list li .destroy:hover{color:#af5b5e}#todo-list li .destroy:after{content:'×'}#todo-list li:hover .destroy{display:block}#todo-list li .edit{display:none}#todo-list li.editing:last-child{margin-bottom:-1px}#footer{color:#777;padding:10px 15px;height:20px}#footer:before{content:'';position:absolute;right:0;bottom:0;left:0;height:50px;overflow:hidden;box-shadow:0 1px 1px rgba(0,0,0,.2),0 8px 0 -3px #f6f6f6,0 9px 1px -3px rgba(0,0,0,.2),0 16px 0 -6px #f6f6f6,0 17px 2px -6px rgba(0,0,0,.2)}#todo-count{float:left;text-align:left}#todo-count strong{font-weight:300}#filters{margin:0;padding:0;list-style:none;position:absolute;right:0;left:0}#filters li{display:inline}#filters li a{color:inherit;margin:3px;padding:3px 7px;text-decoration:none;border:1px solid transparent;border-radius:3px}#filters li a.selected,#filters li a:hover{border-color:rgba(175,47,47,.1)}#filters li a.selected{border-color:rgba(175,47,47,.2)}#clear-completed,html #clear-completed:active{float:right;line-height:20px;text-decoration:none;cursor:pointer;visibility:hidden;position:relative}#clear-completed::after{visibility:visible;content:'Clear completed';position:absolute;right:0;white-space:nowrap}#clear-completed:hover::after,#info a:hover{text-decoration:underline}#info{margin:65px auto 0;color:#bfbfbf;font-size:10px;text-shadow:0 1px 0 rgba(255,255,255,.5);text-align:center}#info p{line-height:1}#info a{color:inherit;text-decoration:none;font-weight:400}@media screen and (-webkit-min-device-pixel-ratio:0){#todo-list li .toggle,#toggle-all{background:0 0}#todo-list li .toggle{height:40px}#toggle-all{-webkit-transform:rotate(90deg);transform:rotate(90deg);-webkit-appearance:none;appearance:none}}@media (max-width:430px){#footer{height:50px}#filters{bottom:10px}}body{background:#bdecff}");
});
//# sourceMappingURL=todo.js.map