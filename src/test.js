var Local = require('./local');
var Async = require('async');
var _ = require('underscore');
var Path = require('path');
var Minimatch = require('minimatch');
var Console = require('./console');

module.exports = {

  tests: [],

  register: function(files, body) {
    if (!_.isArray(files)) files = [files];

    this.tests.push({files: files, body: body});
  },

  execute: function(callback) {
    // Get all untested files
    Local.dirUntouchedFiles('test', Local.cwd(), function(err, files) {
      if (err) return callback(err);

      // Determine which test cases need to be run.
      var tests = _.filter(this.tests, function(test) {
        // Determine if any of this test's dependent files have changed
        return _.any(files, function(file) {
          var fileRelative = Path.relative(Local.cwd(), file);
          return _.any(test.files, function(filePattern) {
            return Minimatch(fileRelative, filePattern);
          });
        });
      });

      if (tests.length > 0) {
        Console.log(Console.bold('Running ' + tests.length + ' tests'));
      } else {
        Console.log(Console.green(Console.bold('No tests to run')));
        return callback();
      }

      // Run the tests sequentially.
      Async.eachSeries(tests, function(test, callback) {
        test.body(function(err) {
          process.stdout.write(Console.green('.'));
          callback(err);
        });
      }, function(err) {
        if (err) return callback(err);

        Console.log(Console.green(Console.bold('\nAll tests passed')));

        // Mark all files as tested.
        Local.dirTouchFiles('test', Local.cwd(), callback);
      });
    }.bind(this));
  }
};