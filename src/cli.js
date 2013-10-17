var Async = require('async');
var _ = require('underscore');
var VM = require('vm');
var Fs = require('fs');
var Path = require('path');

var CLI = module.exports = {

  operations: {},

  register: function(name, dependencies, body) {
    if (arguments.length == 2) {
      body = arguments[1];
      dependencies = [];
    }

    this.operations[name] = {
      name: name,
      dependencies: dependencies,
      body: body
    }
  },

  execute: function(callback) {
    var Hmwk = require('./hmwk');

    Async.series([
      function(callback) {
        Hmwk.store.load(callback)
      },
      function(callback) {
        var names = CLI.dependencies(process.argv.slice(2));

        var plan = {};
        _.each(names, function(name) {
          var operation = CLI.operations[name];

          plan[name] = [].concat(
            operation.dependencies,
            [operation.body.bind(Hmwk)]
          );
        });

        Async.auto(plan, callback);
      },
      function(callback) {
        Hmwk.remote.end(callback);
      }
    ], callback);
  },

  dependencies: function(names) {
    var dependencies = names;

    _.each(names, function(name) {
      var operation = this.operations[name];
      if (!operation) throw new Error("Couldn't find operation for '" + name + "'");

      dependencies = _.union(
        dependencies,
        this.dependencies(operation.dependencies)
      );
    }, this);

    return dependencies;
  }
};