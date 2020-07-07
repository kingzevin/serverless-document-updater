// Generated by CoffeeScript 1.7.1
(function() {
  var COUNT, HOST, LockManager, MAX_REDIS_REQUEST_LENGTH, PID, Profiler, RND, Settings, crypto, keys, logger, metrics, os, rclient, redis;

  metrics = require('./Metrics');

  Settings = require('settings-sharelatex');

  redis = require("redis-sharelatex");

  rclient = redis.createClient(Settings.redis.lock);

  keys = Settings.redis.lock.key_schema;

  logger = require("logger-sharelatex");

  os = require("os");

  crypto = require("crypto");

  Profiler = require("./Profiler");

  HOST = os.hostname();

  PID = process.pid;

  RND = crypto.randomBytes(4).toString('hex');

  COUNT = 0;

  MAX_REDIS_REQUEST_LENGTH = 5000;

  module.exports = LockManager = {
    LOCK_TEST_INTERVAL: 50,
    MAX_TEST_INTERVAL: 1000,
    MAX_LOCK_WAIT_TIME: 10000,
    LOCK_TTL: 30,
    randomLock: function() {
      var time;
      time = Date.now();
      return "locked:host=" + HOST + ":pid=" + PID + ":random=" + RND + ":time=" + time + ":count=" + (COUNT++);
    },
    unlockScript: 'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end',
    tryLock: function(doc_id, callback) {
      var key, lockValue, profile;
      if (callback == null) {
        callback = function(err, isFree) {};
      }
      lockValue = LockManager.randomLock();
      key = keys.blockingKey({
        doc_id: doc_id
      });
      profile = new Profiler("tryLock", {
        doc_id: doc_id,
        key: key,
        lockValue: lockValue
      });
      return rclient.set(key, lockValue, "EX", this.LOCK_TTL, "NX", function(err, gotLock) {
        var timeTaken;
        if (err != null) {
          return callback(err);
        }
        if (gotLock === "OK") {
          metrics.inc("doc-not-blocking");
          timeTaken = profile.log("got lock").end();
          if (timeTaken > MAX_REDIS_REQUEST_LENGTH) {
            return LockManager.releaseLock(doc_id, lockValue, function(err, result) {
              if (err != null) {
                return callback(err);
              }
              return callback(null, false);
            });
          } else {
            return callback(null, true, lockValue);
          }
        } else {
          metrics.inc("doc-blocking");
          profile.log("doc is locked").end();
          return callback(null, false);
        }
      });
    },
    getLock: function(doc_id, callback) {
      var attempt, profile, startTime, testInterval;
      if (callback == null) {
        callback = function(error, lockValue) {};
      }
      startTime = Date.now();
      testInterval = LockManager.LOCK_TEST_INTERVAL;
      profile = new Profiler("getLock", {
        doc_id: doc_id
      });
      return (attempt = function() {
        var e;
        if (Date.now() - startTime > LockManager.MAX_LOCK_WAIT_TIME) {
          e = new Error("Timeout");
          e.doc_id = doc_id;
          profile.log("timeout").end();
          return callback(e);
        }
        return LockManager.tryLock(doc_id, function(error, gotLock, lockValue) {
          if (error != null) {
            return callback(error);
          }
          profile.log("tryLock");
          if (gotLock) {
            profile.end();
            return callback(null, lockValue);
          } else {
            setTimeout(attempt, testInterval);
            return testInterval = Math.min(testInterval * 2, LockManager.MAX_TEST_INTERVAL);
          }
        });
      })();
    },
    checkLock: function(doc_id, callback) {
      var key;
      if (callback == null) {
        callback = function(err, isFree) {};
      }
      key = keys.blockingKey({
        doc_id: doc_id
      });
      return rclient.exists(key, function(err, exists) {
        if (err != null) {
          return callback(err);
        }
        exists = parseInt(exists);
        if (exists === 1) {
          metrics.inc("doc-blocking");
          return callback(null, false);
        } else {
          metrics.inc("doc-not-blocking");
          return callback(null, true);
        }
      });
    },
    releaseLock: function(doc_id, lockValue, callback) {
      var key, profile;
      key = keys.blockingKey({
        doc_id: doc_id
      });
      profile = new Profiler("releaseLock", {
        doc_id: doc_id,
        key: key,
        lockValue: lockValue
      });
      return rclient["eval"](LockManager.unlockScript, 1, key, lockValue, function(err, result) {
        if (err != null) {
          return callback(err);
        } else if ((result != null) && result !== 1) {
          profile.log("unlockScript:expired-lock").end();
          logger.error({
            doc_id: doc_id,
            key: key,
            lockValue: lockValue,
            redis_err: err,
            redis_result: result
          }, "unlocking error");
          metrics.inc("unlock-error");
          return callback(new Error("tried to release timed out lock"));
        } else {
          profile.log("unlockScript:ok").end();
          return callback(null, result);
        }
      });
    }
  };

}).call(this);

//# sourceMappingURL=LockManager.map
