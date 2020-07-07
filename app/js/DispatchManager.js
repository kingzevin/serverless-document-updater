// Generated by CoffeeScript 1.7.1
(function() {
  var DispatchManager, Errors, Keys, Metrics, RateLimitManager, Settings, UpdateManager, logger, redis;

  Settings = require('settings-sharelatex');

  logger = require('logger-sharelatex');

  Keys = require('./UpdateKeys');

  redis = require("redis-sharelatex");

  Errors = require("./Errors");

  UpdateManager = require('./UpdateManager');

  Metrics = require('./Metrics');

  RateLimitManager = require('./RateLimitManager');

  module.exports = DispatchManager = {
    createDispatcher: function(RateLimiter) {
      var client, worker;
      client = redis.createClient(Settings.redis.documentupdater);
      worker = {
        client: client,
        _waitForUpdateThenDispatchWorker: function(callback) {
          var timer;
          if (callback == null) {
            callback = function(error) {};
          }
          timer = new Metrics.Timer("worker.waiting");
          return worker.client.blpop("pending-updates-list", 0, function(error, result) {
            var backgroundTask, doc_id, doc_key, list_name, project_id, _ref;
            logger.log("getting pending-updates-list", error, result);
            //zevin
            logger.log({blpop:true}, 'zevin\'s met blpop\n\n')            
            timer.done();
            if (error != null) {
              return callback(error);
            }
            if (result == null) {
              return callback();
            }
            list_name = result[0], doc_key = result[1];
            _ref = Keys.splitProjectIdAndDocId(doc_key), project_id = _ref[0], doc_id = _ref[1];
            backgroundTask = function(cb) {
              return UpdateManager.processOutstandingUpdatesWithLock(project_id, doc_id, function(error) {
                var logAsWarning;
                if (error != null) {
                  logAsWarning = (error instanceof Errors.OpRangeNotAvailableError) || (error instanceof Errors.DeleteMismatchError);
                  if (logAsWarning) {
                    logger.warn({
                      err: error,
                      project_id: project_id,
                      doc_id: doc_id
                    }, "error processing update");
                  } else {
                    logger.error({
                      err: error,
                      project_id: project_id,
                      doc_id: doc_id
                    }, "error processing update");
                  }
                }
                return cb();
              });
            };
            return RateLimiter.run(backgroundTask, callback);
          });
        },
        run: function() {
          if (Settings.shuttingDown) {
            return;
          }
          return worker._waitForUpdateThenDispatchWorker((function(_this) {
            return function(error) {
              if (error != null) {
                logger.error({
                  err: error
                }, "Error in worker process");
                throw error;
              } else {
                return worker.run();
              }
            };
          })(this));
        }
      };
      return worker;
    },
    createAndStartDispatchers: function(number) {
      var RateLimiter, i, worker, _i, _results;
      RateLimiter = new RateLimitManager(number);
      _results = [];
      for (i = _i = 1; 1 <= number ? _i <= number : _i >= number; i = 1 <= number ? ++_i : --_i) {
        worker = DispatchManager.createDispatcher(RateLimiter);
        _results.push(worker.run());
      }
      return _results;
    }
  };

}).call(this);

//# sourceMappingURL=DispatchManager.map
