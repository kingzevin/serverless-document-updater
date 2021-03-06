// Generated by CoffeeScript 1.7.1
(function() {
  var Errors, MAX_HTTP_REQUEST_LENGTH, Metrics, PersistenceManager, Settings, logger, request, updateMetric,
    __slice = [].slice;

  Settings = require("settings-sharelatex");

  Errors = require("./Errors");

  Metrics = require("./Metrics");

  logger = require("logger-sharelatex");

  request = (require("requestretry")).defaults({
    maxAttempts: 2,
    retryDelay: 10
  });

  MAX_HTTP_REQUEST_LENGTH = 5000;

  updateMetric = function(method, error, response) {
    var status;
    status = (error != null ? error.connect : void 0) === true ? "" + error.code + " (connect)" : error != null ? error.code : response != null ? response.statusCode : void 0;
    Metrics.inc(method, 1, {
      status: status
    });
    if ((error != null ? error.attempts : void 0) > 1) {
      Metrics.inc("" + method + "-retries", 1, {
        status: 'error'
      });
    }
    if ((response != null ? response.attempts : void 0) > 1) {
      return Metrics.inc("" + method + "-retries", 1, {
        status: 'success'
      });
    }
  };

  module.exports = PersistenceManager = {
    getDoc: function(project_id, doc_id, _callback) {
      var callback, timer, url;
      if (_callback == null) {
        _callback = function(error, lines, version, ranges, pathname, projectHistoryId, projectHistoryType) {};
      }
      timer = new Metrics.Timer("persistenceManager.getDoc");
      callback = function() {
        var args;
        args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
        timer.done();
        return _callback.apply(null, args);
      };
      url = "" + Settings.apis.web.url + "/project/" + project_id + "/doc/" + doc_id;
      return request({
        url: url,
        method: "GET",
        headers: {
          "accept": "application/json"
        },
        auth: {
          user: Settings.apis.web.user,
          pass: Settings.apis.web.pass,
          sendImmediately: true
        },
        jar: false,
        timeout: MAX_HTTP_REQUEST_LENGTH
      }, function(error, res, body) {
        var e;
        updateMetric('getDoc', error, res);
        if (error != null) {
          return callback(error);
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            body = JSON.parse(body);
          } catch (_error) {
            e = _error;
            return callback(e);
          }
          if (body.lines == null) {
            return callback(new Error("web API response had no doc lines"));
          }
          if ((body.version == null) || !body.version instanceof Number) {
            return callback(new Error("web API response had no valid doc version"));
          }
          if (body.pathname == null) {
            return callback(new Error("web API response had no valid doc pathname"));
          }
          return callback(null, body.lines, body.version, body.ranges, body.pathname, body.projectHistoryId, body.projectHistoryType);
        } else if (res.statusCode === 404) {
          return callback(new Errors.NotFoundError("doc not not found: " + url));
        } else {
          return callback(new Error("error accessing web API: " + url + " " + res.statusCode));
        }
      });
    },
    setDoc: function(project_id, doc_id, lines, version, ranges, lastUpdatedAt, lastUpdatedBy, _callback) {
      var callback, timer, url;
      if (_callback == null) {
        _callback = function(error) {};
      }
      timer = new Metrics.Timer("persistenceManager.setDoc");
      callback = function() {
        var args;
        args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
        timer.done();
        return _callback.apply(null, args);
      };
      url = "" + Settings.apis.web.url + "/project/" + project_id + "/doc/" + doc_id;
      return request({
        url: url,
        method: "POST",
        json: {
          lines: lines,
          ranges: ranges,
          version: version,
          lastUpdatedBy: lastUpdatedBy,
          lastUpdatedAt: lastUpdatedAt
        },
        auth: {
          user: Settings.apis.web.user,
          pass: Settings.apis.web.pass,
          sendImmediately: true
        },
        headers: { // document-updater.bug.headers
          "accept": "application/json, text/plain"
        },
        jar: false,
        timeout: MAX_HTTP_REQUEST_LENGTH
      }, function(error, res, body) {
        updateMetric('setDoc', error, res);
        if (error != null) {
          return callback(error);
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          return callback(null);
        } else if (res.statusCode === 404) {
          return callback(new Errors.NotFoundError("doc not not found: " + url));
        } else {
          return callback(new Error("error accessing web API: " + url + " " + res.statusCode));
        }
      });
    }
  };

}).call(this);

//# sourceMappingURL=PersistenceManager.map
