var Fs = require('fs');
var Path = require('path');
var _ = require('underscore');
var Util = require('util');
var Local = require('./local');

module.exports = Store = {
  // TODO don't load if already loaded
  load: function(callback) {
    Fs.readFile(Path.join(Local.cwd(), '.hmwk'), {encoding: 'utf8'}, function(err, string) {
      if (err && err.code === 'ENOENT') {
        return callback();
      } else if (err) {
        callback(err);
      } else {
        try {
          _.extend(this, JSON.parse(string));
        } catch (e) {}
        callback();
      }
    }.bind(this));
  },

  // TODO optimisticlly return early
  save: function(callback) {
    Fs.writeFile(Path.join(Local.cwd(), '.hmwk'), JSON.stringify(this), callback);
  }
};