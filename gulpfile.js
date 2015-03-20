var gulp = require('gulp'),
  gulpins = require('gulp-load-plugins')(),
  bowerPackage = require('./bower.json'),
  sources = {
    srcPath: 'src/**/*',
    less: 'src/**/*.less'
  },
  config = {
    url: 'http://localhost',
    port: 9000,
    browser: 'google chrome'
  };

/**
 * Init gulp help
 */
gulpins.help(gulp);

gulp.task('less', 'Compile less to css', function () {
    return gulp.src(sources.less)
        .pipe(gulpins.plumber())
        .pipe(gulpins.less({compress: true}))
        .pipe(gulp.dest('src/'));
});

gulp.task('version', 'Print module version.', [], function() {
  process.stdout.write('\n' + bowerPackage.name + ' v' + bowerPackage.version + '\n\n');
}, {
  aliases: ['v']
});


gulp.task('serve', 'Start server', ['less'], function () {
  gulpins.connect.server({
    root: [__dirname],
    port: config.port,
    livereload: true
  });

  gulp.src('index.html')
    .pipe(gulpins.open('', {
      url: config.url + ':' + config.port + '/index.html',
      app: config.browser
    }));
});

gulp.task('default', 'Run the application', ['less', 'serve'], function () {
  gulp.watch(sources.less, ['less']);

  gulpins.watch(sources.srcPath).pipe(gulpins.connect.reload());
});