var Fs = require('fs');
var ChildProcess = require('child_process');
var Async = require('async');
var Path = require('path');

var Local = module.exports = {

  cwd: function() {
    return process.cwd();
  },

  execute: function(command, args, callback) {
    var processCmd = ChildProcess.spawn(command, args);

    processCmd.stdout.pipe(process.stdout);
    processCmd.stderr.pipe(process.stderr);

    processCmd.on('close', function (code) {
      callback(code !== 0 ? new Error('Command exited with code ' + code) : null);
    });
  },

  dirWalk: function(path, iterator, callback) {
    Fs.stat(path, function(err, stats) {
      if (err) return callback(err);

      if (stats.isDirectory()) {
        Fs.readdir(path, function(err, subfiles) {
          if (err) return callback(err);
          var returns = {};
          Async.each(subfiles, function(subpath, callback) {
            Local.dirWalk(Path.join(path, subpath), iterator, function(err, returns_) {
              _.extend(returns, returns_);
              callback(err);
            });
          }, function(err) {
            callback(err, returns);
          });
        });
      } else if (!_.contains(['.', '..', '.hmwk'], Path.basename(path))) {
        var returns = {};
        returns[path] = iterator(path, stats);
        callback(null, returns);
      } else {
        callback(null, {});
      }
    });
  },

  dirFileModifiedTimes: function(path, callback) {
    Local.dirWalk(path, function(path, stats) {
      return stats.mtime.getTime();
    }, callback);
  },

  dirUntouchedFiles: function(name, dir, callback) {
    var Store = require('./store');
    var mtimesPrev = (Store.mtimes = Store.mtimes || {})[name] || {};

    // TODO load from store explicitly

    Local.dirFileModifiedTimes(dir, function(err, mtimes) {
      if (err) return callback(err);

      var files = _.keys(mtimes);
      if (mtimesPrev) {
        files = _.filter(files, function(file) {
          return mtimesPrev[file] != mtimes[file];
        });
      }

      callback(null, files);
    }.bind(this));
  },

  dirTouchFiles: function(name, dir, callback) {
    var Store = require('./store');

    Local.dirFileModifiedTimes(dir, function(err, mtimes) {
      if (err) return callback(err);
      Store.mtimes[name] = mtimes;
      Store.save(callback);
    }.bind(this));
  }

};