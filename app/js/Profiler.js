// Generated by CoffeeScript 1.7.1
(function() {
  var Profiler, Settings, deltaMs, logger;

  Settings = require('settings-sharelatex');

  logger = require('logger-sharelatex');

  deltaMs = function(ta, tb) {
    var milliSeconds, nanoSeconds;
    nanoSeconds = (ta[0] - tb[0]) * 1e9 + (ta[1] - tb[1]);
    milliSeconds = Math.floor(nanoSeconds * 1e-6);
    return milliSeconds;
  };

  module.exports = Profiler = (function() {
    Profiler.prototype.LOG_CUTOFF_TIME = 1000;

    function Profiler(name, args) {
      this.name = name;
      this.args = args;
      this.t0 = this.t = process.hrtime();
      this.start = new Date();
      this.updateTimes = [];
    }

    Profiler.prototype.log = function(label) {
      var dtMilliSec, t1;
      t1 = process.hrtime();
      dtMilliSec = deltaMs(t1, this.t);
      this.t = t1;
      this.updateTimes.push([label, dtMilliSec]);
      return this;
    };

    Profiler.prototype.end = function(message) {
      var args, k, totalTime, v, _ref;
      totalTime = deltaMs(this.t, this.t0);
      if (totalTime > this.LOG_CUTOFF_TIME) {
        args = {};
        _ref = this.args;
        for (k in _ref) {
          v = _ref[k];
          args[k] = v;
        }
        args.updateTimes = this.updateTimes;
        args.start = this.start;
        args.end = new Date();
        logger.log(args, this.name);
      }
      return totalTime;
    };

    return Profiler;

  })();

}).call(this);

//# sourceMappingURL=Profiler.map