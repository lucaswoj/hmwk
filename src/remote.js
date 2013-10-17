var SSH = require('ssh2');
var Path = require('path');
_ = require('underscore');
Util = require('util');
var Local = require('./local');
var Async = require('Async');
var Console = require('./console');
var Pool = require('generic-pool').Pool;
var Minimatch = require('minimatch');

var Connection = function(settings) {

  _.extend(this, {

  connectSSH: function(callback) {
    Console.log('Connecting to ' + Console.bold(settings.host));

    var ssh = this.ssh = new SSH();

    ssh.on('error', function(err) { if (err) callback(err) });
    ssh.on('close', function(err) { if (err) callback(err) });

    ssh.on('ready', function(err) {
      if (err) return callback(err);

      ssh.sftp(function(err, sftp) {
        this.sftp = sftp;
        callback(err);
      }.bind(this));
    }.bind(this));

    ssh.connect({
      host: settings.host,
      username: settings.user,
      agent: process.env.SSH_AUTH_SOCK
    });
  },

  poolFill: function(callback) {
    this.pool = Pool({
      name: 'SSH connections',
      create: function(callback) {
        callback(null, {sftp: this.sftp, ssh: this.ssh});
      }.bind(this),
      min: settings.threads,
      max: settings.threads,
      destroy: function() {}
    });

    callback();
  },

  connect: function(callback) {
    Async.series([
      this.connectSSH.bind(this),
      this.poolFill.bind(this)
    ], callback);
  },

    // Convert a local path to its remote equivilant
    path: function(path) {
      return Path.join(settings.directory, Path.relative(Local.cwd(), path));
    },

    cwd: function() {
      return this.path(Local.cwd());
    },

    executeDiff: function(commandExpected, commandActual, callback) {
      Async.series({
        actual: function(callback) {
          this.execute(commandActual, callback, {throw_: false});
        }.bind(this),

        expected: function(callback) {
          this.execute(commandExpected, callback, {throw_: false});
        }.bind(this)
      }, function(err, results) {
        var actual = results.actual[results.actual.length - 1];
        var expected = results.expected[results.expected.length - 1];
        
        var err;
        if (actual.stdout != expected.stdout || actual.stderr != expected.stderr || actual.code != expected.code) {
          err = new Remote.ExecuteDiffError(expected, actual);
        }

        callback(err, {actual: actual, expected: expected});
      });
    },

    execute: function(commands, callback, options) {
      if (_.isString(commands)) commands = [commands];

      var results = [];

      Async.eachSeries(commands, function(command, callback) {
        this.executeOne(command, function(err, result) {
          results.push(result);
          callback(err);
        }.bind(this), options);
      }.bind(this), function(err) {
        callback(err, results);
      });
    },

    executeOne: function(command, callback, options) {
      options = options || {};

      this.pool.acquire(function(err, connection) {
        if (err) return callback(err);

        var commandFull = 'cd ' + this.cwd() + '; ' + command + ';';

        var result = {
          command: command,
          commandFull: commandFull,
          stdout: '',
          stderr: '',
          code: null
        };

        connection.ssh.exec(commandFull, function(err, stream) {
          if (err) return callback(err);

          stream.on('data', function(string, stream) {
            if (stream === 'stderr') {
              result.stderr += string;
            } else {
              result.stdout += string;
            }
          }.bind(this));

          stream.on('exit', function(code) {
            result.code = code;

            var err;
            if (code != 0 && options.throw_ !== false) {
              err = new Remote.ExecuteError(result);
            }
            this.pool.release(connection);
            callback(err, result);
          }.bind(this));
        }.bind(this));
      }.bind(this));
    },

    sync: function(callback) {
      var name = 'sync' + settings.host + Local.cwd();
      var dir = Local.cwd();

      Local.dirUntouchedFiles(name, dir, function(err, files) {
        Async.each(files, function(file, callback) {
          if (file.indexOf('node_modules') != -1) {
            callback();
          } else {
            this.fileUpload(file, callback);
          }
        }.bind(this), function(err) {
          Local.dirTouchFiles(name, dir, callback);
        });
      }.bind(this));
    },

    fileUpload: function(path, callback) {
      this.pool.acquire(function(err, connection) {
        if (err) return callback(err);

        Console.log('Uploading ' + Console.bold(Path.relative(Local.cwd(), path)));
        connection.sftp.fastPut(path, this.path(path), function(err) {
          this.pool.release(connection)
          callback(err);
        }.bind(this));
      }.bind(this));
    },

    fileWrite: function(path, contents, callback) {
      var stream = this.sftp.createWriteStream(this.path(path));
      stream.end(contents, 'utf8', callback);
    },

    end: function(callback) {
      this.ssh.on('end', function() {
        Console.log('Closed SSH connection');
        callback();
      });
      this.ssh.end();

      this.pool.drain(function() {
        this.pool.destroyAllNow();
      }.bind(this));
    }

  });
};

var Remote = module.exports = {

  connections: [],

  connect: function(settings, callback) {
    var connection = new Connection(settings);
    this[settings.name] = connection;
    this.connections.push(connection);

    connection.connect(callback);
  },

  end: function(callback) {
    Async.each(this.connections, function(connection, callback) {
      connection.end(callback);
    }, callback);
  },

  ExecuteDiffError: function(actual, expected) {
    function label(string) {
      return Console.bold(Console.red(string));
    }

    this.toString = function() {
      Console.log(label('Expected two commands to produce same output but they did not'));

      Console.log(Console.indent(actual.command, 2));
      Console.log(Console.indent(expected.command, 2));
      Console.log('');

      _.each(['stdout', 'stderr'], function(field) {
        if (expected[field] != actual[field]) {
          Console.log(Console.indent(label(field), 2));
          Console.log(Console.indent(Console.diff(actual[field], expected[field]), 4));
          Console.log('');
        }
      });

      if (actual.code != expected.code) {
        Console.log(Console.indent(label('Return Code'), 2));
        Console.log(Console.indent('Actual: ' + actual.code, 4));
        Console.log(Console.indent('Expected: ' + expected.code, 4));
        Console.log('');
      }
    }
  },

  ExecuteError: function(result) {
    this.toString = function() {
      function label(string) {
        return Console.bold(Console.red(string));
      }

      Console.log(label('Error executing a remote command\n'));
      Console.log(Console.indent(label('command: ') + result.command, 2));
      Console.log(Console.indent(label('return code: ') + result.code, 2));
      Console.log(Console.indent(label('stdout:'), 2));
      Console.log(Console.indent(result.stdout, 4));
      Console.log(Console.indent(label('stderr:'), 2));
      Console.log(Console.indent(result.stderr, 4));
    }
  }
}