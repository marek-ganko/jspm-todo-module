var gulp = require('gulp'),
  gulpPlugins = require('gulp-load-plugins')(),
  argv = gulpPlugins.util.env,
  log = gulpPlugins.util.log,
  colors = gulpPlugins.util.colors,
  jshintConfig = require('./jshint.config.json'),
  browserSync = require('browser-sync'),
  fs = require('fs'),

  getBowerPackage = function () {
    return JSON.parse(fs.readFileSync('./bower.json', 'utf8'))
  },
  printVersion = function () {
    var bowerPackage = getBowerPackage();
    log(colors.blue('Current package version: ' + bowerPackage.version));
  },
  sources = {
    srcPath: 'src/**/*',
    less: 'src/**/*.less',
    js: 'src/**/*.js',
    karmaConfig: 'test/karma.conf.js',
    protractorConfig: 'test/protractor.conf.js',
    e2eSrcFiles: 'test/e2e/src/**/*.js',
    e2eDistFiles: 'test/e2e/dist/**/*.js',
    e2eDistPath: 'test/e2e/dist/',
    versioningFiles: ['./bower.json', './package.json'],
    bundlesPath: 'dist/*'
  },
  config = {
    url: 'http://localhost',
    port: 9000,
    browser: 'google chrome'
  };

/**
 * Init gulp help
 */
gulpPlugins.help(gulp);

gulp.task('less', 'Compile less to css', function () {
  return gulp.src(sources.less)
    .pipe(gulpPlugins.plumber())
    .pipe(gulpPlugins.less({compress: true}))
    .pipe(gulp.dest('src/'));
});

gulp.task('version', 'Print bower package version.', [], function () {
  printVersion();
}, {
  aliases: ['v']
});

gulp.task('runServer', 'Run server', function () {
  gulpPlugins.connect.server({
    root: './',
    port: config.port
  });
});


gulp.task('runServer', 'Run server', function () {
  browserSync({
    server: {
      baseDir: "./"
    }
  });
});


gulp.task('jshint', 'Run jshint on the whole project', function () {
  gulp.src(sources.js)
    .pipe(gulpPlugins.jshint(jshintConfig))
    .pipe(gulpPlugins.jshint.reporter('jshint-stylish'));
});

gulp.task('watch', 'Run the application', ['less', 'jshint', 'serve'], function () {
  gulp.watch(sources.less, ['less']);
  gulp.watch(sources.js, ['jshint']);

  gulpPlugins.watch(sources.srcPath).on("change", browserSync.reload);
});

gulp.task('createBundle', 'Create JSPM bundles', ['createBundle:sfx', 'createBundle:systemjs'], function () {
});

gulp.task('createBundle:sfx', 'Create JSPM bundle-sfx',
  gulpPlugins.shell.task([
    'jspm bundle-sfx src/Todo dist/todo.js',
    'jspm bundle-sfx src/Todo dist/todo.min.js --minify'
  ])
);

gulp.task('createBundle:systemjs', 'Create JSPM bundle',
  gulpPlugins.shell.task([
    'jspm bundle src/Todo dist/todo-systemjs.js',
    'jspm bundle src/Todo dist/todo-systemjs.min.js --minify'
  ])
);

gulp.task('test', 'Run unit tests', function () {
  return gulp.src('./')
    .pipe(gulpPlugins.karma({
      configFile: sources.karmaConfig,
      action: 'run'
    }))
    .on('error', function (e) {
      log(colors.red('Unit tests failed'));
      process.exit(1);
    });
});

gulp.task('test:watch', 'Run unit tests with watch', function () {
  return gulp.src('./')
    .pipe(gulpPlugins.karma({
      configFile: sources.karmaConfig,
      action: 'watch'
    }));
});

gulp.task('test:e2e:removeTranspiled', 'Remove transpiled e2e tests directory', function () {
  return gulp.src(sources.e2eDistPath, {read: false})
    .pipe(gulpPlugins.clean());
});

gulp.task('test:e2e:transpile', 'Transpile e2e tests from ES6 into ES5', function () {
  return gulp.src(sources.e2eSrcFiles)
    .pipe(gulpPlugins.plumber())
    .pipe(gulpPlugins.babel())
    .pipe(gulp.dest(sources.e2eDistPath));
});

gulp.task('test:e2e', 'Run e2e tests', ['transpileE2e', 'runServer'], function () {
  gulp.src(sources.e2eDistFiles)
    .pipe(gulpPlugins.angularProtractor({
      configFile: sources.protractorConfig,
      args: ['--baseUrl', config.url + ':' + config.port],
      autoStartStopServer: true,
      debug: true
    }))
    .on('error', function (e) {
      log(colors.red('E2e tests failed'));
      process.exit(1);
    })
    .on('end', function () {
      process.exit();
    });
});

gulp.task('bump', 'Bump package version', ['bump:push'], function () {
  printVersion();
}, {
  options: {
    'release': 'x.0.0',
    'feature': '0.x.0',
    'patch': '0.0.x [Default]'
  }
});

gulp.task('bump:push', 'Push commits to master branch', ['bump:tag'], function () {
  return gulpPlugins.git.push('origin', 'master', {args: '--tags'});
});

gulp.task('bump:tag', 'Create tag from version in ' + sources.versioningFiles[0], ['bump:commit'], function () {
  return gulp.src(sources.versioningFiles[0]).pipe(gulpPlugins.tagVersion());
});

gulp.task('bump:commit', 'Commit versioning files', ['bump:add'], function () {
  return gulp.src(sources.versioningFiles.concat([sources.bundlesPath])).pipe(gulpPlugins.git.commit('Bump version to ' + getBowerPackage().version));
});

gulp.task('bump:add', 'Add versioning files to commit', ['bump:pull', 'createBundle'], function () {
  return gulp.src(sources.versioningFiles.concat([sources.bundlesPath])).pipe(gulpPlugins.git.add());
});

gulp.task('bump:pull', 'Checkout master branch', ['bump:checkout'], function () {
  return gulpPlugins.git.pull('origin', 'master');
});

gulp.task('bump:checkout', 'Checkout master branch', ['bump:version'], function () {
  return gulpPlugins.git.checkout('master');
});

gulp.task('bump:version', 'Bump package version', function () {
  var getType = function (argv) {
    if (argv.feature) {
      return 'minor';
    }
    if (argv.release) {
      return 'major';
    }
    return 'patch';
  };

  return gulp.src(sources.versioningFiles)
    .pipe(gulpPlugins.bump({type: getType(argv)}))
    .pipe(gulp.dest('.'));
});