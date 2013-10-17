var Diff = require('diff');

var generate = function(start, end) {
  return function(string) {
    return start + string + end;
  };
}

module.exports = {
  bold         : generate('\x1B[1m',  '\x1B[22m'),
  italic       : generate('\x1B[3m',  '\x1B[23m'),
  underline    : generate('\x1B[4m',  '\x1B[24m'),
  inverse      : generate('\x1B[7m',  '\x1B[27m'),
  strikethrough: generate('\x1B[9m',  '\x1B[29m'),

  white  : generate('\x1B[37m', '\x1B[39m'),
  grey   : generate('\x1B[90m', '\x1B[39m'),
  black  : generate('\x1B[30m', '\x1B[39m'),
  blue   : generate('\x1B[34m', '\x1B[39m'),
  cyan   : generate('\x1B[36m', '\x1B[39m'),
  green  : generate('\x1B[32m', '\x1B[39m'),
  magenta: generate('\x1B[35m', '\x1B[39m'),
  red    : generate('\x1B[31m', '\x1B[39m'),
  yellow : generate('\x1B[33m', '\x1B[39m'),

  whiteBackground  : generate('\x1B[47m', '\x1B[49m'),
  greyBackground   : generate('\x1B[49;5;8m', '\x1B[49m'),
  blackBackground  : generate('\x1B[40m', '\x1B[49m'),
  blueBackground   : generate('\x1B[44m', '\x1B[49m'),
  cyanBackground   : generate('\x1B[46m', '\x1B[49m'),
  greenBackground  : generate('\x1B[42m', '\x1B[49m'),
  magentaBackground: generate('\x1B[45m', '\x1B[49m'),
  redBackground    : generate('\x1B[41m', '\x1B[49m'),
  yellowBackground : generate('\x1B[43m', '\x1B[49m'),

  indent: function(string, amount) {
    var indent = Array(amount).join(' ');
    return indent + (string || '').replace(/\n/g, '\n' + indent);
  },

  log: console.log.bind(console),

  diff: function(actual, expected) {
    var type = 'Chars';

    return _.map(Diff['diff' + type](actual, expected), function(string){
      if (/^(\n+)$/.test(string.value)) string.value = Array(++RegExp.$1.length).join('<newstring>');
      if (string.added) return this.green(string.value);
      if (string.removed) return this.red(string.value);
      return string.value;
    }, this).join('');
  }
}