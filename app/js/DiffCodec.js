// Generated by CoffeeScript 1.7.1
(function() {
  var DiffCodec, diff_match_patch, dmp;

  diff_match_patch = require("../lib/diff_match_patch").diff_match_patch;

  dmp = new diff_match_patch();

  module.exports = DiffCodec = {
    ADDED: 1,
    REMOVED: -1,
    UNCHANGED: 0,
    diffAsShareJsOp: function(before, after, callback) {
      var content, diff, diffs, ops, position, type, _i, _len;
      if (callback == null) {
        callback = function(error, ops) {};
      }
      diffs = dmp.diff_main(before.join("\n"), after.join("\n"));
      dmp.diff_cleanupSemantic(diffs);
      ops = [];
      position = 0;
      for (_i = 0, _len = diffs.length; _i < _len; _i++) {
        diff = diffs[_i];
        type = diff[0];
        content = diff[1];
        if (type === this.ADDED) {
          ops.push({
            i: content,
            p: position
          });
          position += content.length;
        } else if (type === this.REMOVED) {
          ops.push({
            d: content,
            p: position
          });
        } else if (type === this.UNCHANGED) {
          position += content.length;
        } else {
          throw "Unknown type";
        }
      }
      return callback(null, ops);
    }
  };

}).call(this);

//# sourceMappingURL=DiffCodec.map
