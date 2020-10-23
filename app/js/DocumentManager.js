// Generated by CoffeeScript 1.7.1
(function() {
  var DiffCodec, DocumentManager, Errors, HistoryManager, MAX_UNFLUSHED_AGE, Metrics, PersistenceManager, ProjectHistoryRedisManager, RangesManager, RealTimeRedisManager, RedisManager, async, logger,
    __slice = [].slice;

  RedisManager = require("./RedisManager");

  ProjectHistoryRedisManager = require("./ProjectHistoryRedisManager");

  PersistenceManager = require("./PersistenceManager");

  DiffCodec = require("./DiffCodec");

  logger = require("logger-sharelatex");

  Metrics = require("./Metrics");

  HistoryManager = require("./HistoryManager");

  RealTimeRedisManager = require("./RealTimeRedisManager");

  Errors = require("./Errors");

  RangesManager = require("./RangesManager");

  async = require("async");

  MAX_UNFLUSHED_AGE = 300 * 1000;

  module.exports = DocumentManager = {
    getDoc: function(project_id, doc_id, _callback) {
      var callback, timer;
      if (_callback == null) {
        _callback = function(error, lines, version, ranges, pathname, projectHistoryId, unflushedTime, alreadyLoaded) {};
      }
      timer = new Metrics.Timer("docManager.getDoc");
      callback = function() {
        var args;
        args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
        timer.done();
        return _callback.apply(null, args);
      };
      return RedisManager.getDoc(project_id, doc_id, function(error, lines, version, ranges, pathname, projectHistoryId, unflushedTime) {
        if (error != null) {
          return callback(error);
        }
        if ((lines == null) || (version == null)) {
          logger.log({
            project_id: project_id,
            doc_id: doc_id
          }, "doc not in redis so getting from persistence API");
          return PersistenceManager.getDoc(project_id, doc_id, function(error, lines, version, ranges, pathname, projectHistoryId, projectHistoryType) {
            if (error != null) {
              return callback(error);
            }
            logger.log({
              project_id: project_id,
              doc_id: doc_id,
              lines: lines,
              version: version,
              pathname: pathname,
              projectHistoryId: projectHistoryId,
              projectHistoryType: projectHistoryType
            }, "got doc from persistence API");
            return RedisManager.putDocInMemory(project_id, doc_id, lines, version, ranges, pathname, projectHistoryId, function(error) {
              if (error != null) {
                return callback(error);
              }
              return RedisManager.setHistoryType(doc_id, projectHistoryType, function(error) {
                if (error != null) {
                  return callback(error);
                }
                return callback(null, lines, version, ranges, pathname, projectHistoryId, null, false);
              });
            });
          });
        } else {
          return callback(null, lines, version, ranges, pathname, projectHistoryId, unflushedTime, true);
        }
      });
    },
    getDocAndRecentOps: function(project_id, doc_id, fromVersion, _callback) {
      var callback, timer;
      if (_callback == null) {
        _callback = function(error, lines, version, ops, ranges, pathname, projectHistoryId) {};
      }
      timer = new Metrics.Timer("docManager.getDocAndRecentOps");
      callback = function() {
        var args;
        args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
        timer.done();
        return _callback.apply(null, args);
      };
      return DocumentManager.getDoc(project_id, doc_id, function(error, lines, version, ranges, pathname, projectHistoryId) {
        if (error != null) {
          return callback(error);
        }
        if (fromVersion === -1) {
          return callback(null, lines, version, [], ranges, pathname, projectHistoryId);
        } else {
          return RedisManager.getPreviousDocOps(doc_id, fromVersion, version, function(error, ops) {
            if (error != null) {
              return callback(error);
            }
            return callback(null, lines, version, ops, ranges, pathname, projectHistoryId);
          });
        }
      });
    },
    setDoc: function(project_id, doc_id, newLines, source, user_id, undoing, _callback) {
      var UpdateManager, callback, timer;
      if (_callback == null) {
        _callback = function(error) {};
      }
      timer = new Metrics.Timer("docManager.setDoc");
      callback = function() {
        var args;
        args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
        timer.done();
        return _callback.apply(null, args);
      };
      if (newLines == null) {
        return callback(new Error("No lines were provided to setDoc"));
      }
      UpdateManager = require("./UpdateManager");
      return DocumentManager.getDoc(project_id, doc_id, function(error, oldLines, version, ranges, pathname, projectHistoryId, unflushedTime, alreadyLoaded) {
        if (error != null) {
          return callback(error);
        }
        if ((oldLines != null) && oldLines.length > 0 && (oldLines[0].text != null)) {
          logger.log({
            doc_id: doc_id,
            project_id: project_id,
            oldLines: oldLines,
            newLines: newLines
          }, "document is JSON so not updating");
          return callback(null);
        }
        logger.log({
          doc_id: doc_id,
          project_id: project_id,
          oldLines: oldLines,
          newLines: newLines
        }, "setting a document via http");
        return DiffCodec.diffAsShareJsOp(oldLines, newLines, function(error, op) {
          var o, update, _i, _len, _ref;
          if (error != null) {
            return callback(error);
          }
          if (undoing) {
            _ref = op || [];
            for (_i = 0, _len = _ref.length; _i < _len; _i++) {
              o = _ref[_i];
              o.u = true;
            }
          }
          update = {
            doc: doc_id,
            op: op,
            v: version,
            meta: {
              type: "external",
              source: source,
              user_id: user_id
            }
          };
          return UpdateManager.applyUpdate(project_id, doc_id, update, function(error) {
            if (error != null) {
              return callback(error);
            }
            if (alreadyLoaded) {
              return DocumentManager.flushDocIfLoaded(project_id, doc_id, function(error) {
                if (error != null) {
                  return callback(error);
                }
                return callback(null);
              });
            } else {
              return DocumentManager.flushAndDeleteDoc(project_id, doc_id, function(error) {
                HistoryManager.flushProjectChangesAsync(project_id);
                if (error != null) {
                  return callback(error);
                }
                return callback(null);
              });
            }
          });
        });
      });
    },
    flushDocIfLoaded: function(project_id, doc_id, _callback) {
      var callback, timer;
      if (_callback == null) {
        _callback = function(error) {};
      }
      timer = new Metrics.Timer("docManager.flushDocIfLoaded");
      callback = function() {
        var args;
        args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
        timer.done();
        return _callback.apply(null, args);
      };
      return RedisManager.getDoc(project_id, doc_id, function(error, lines, version, ranges, pathname, projectHistoryId, unflushedTime, lastUpdatedAt, lastUpdatedBy) {
        if (error != null) {
          return callback(error);
        }
        if ((lines == null) || (version == null)) {
          logger.log({
            project_id: project_id,
            doc_id: doc_id
          }, "doc is not loaded so not flushing");
          return callback(null);
        } else {
          logger.log({
            project_id: project_id,
            doc_id: doc_id,
            version: version
          }, "flushing doc");
          return PersistenceManager.setDoc(project_id, doc_id, lines, version, ranges, lastUpdatedAt, lastUpdatedBy, function(error) {
            if (error != null) {
              return callback(error);
            }
            return RedisManager.clearUnflushedTime(doc_id, callback);
          });
        }
      });
    },
    flushAndDeleteDoc: function(project_id, doc_id, _callback) {
      var callback, timer;
      if (_callback == null) {
        _callback = function(error) {};
      }
      timer = new Metrics.Timer("docManager.flushAndDeleteDoc");
      callback = function() {
        var args;
        args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
        timer.done();
        return _callback.apply(null, args);
      };
      return DocumentManager.flushDocIfLoaded(project_id, doc_id, function(error) {
        if (error != null) {
          return callback(error);
        }
        HistoryManager.flushDocChangesAsync(project_id, doc_id);
        return RedisManager.removeDocFromMemory(project_id, doc_id, function(error) {
          if (error != null) {
            return callback(error);
          }
          return callback(null);
        });
      });
    },
    acceptChanges: function(project_id, doc_id, change_ids, _callback) {
      var callback, timer;
      if (change_ids == null) {
        change_ids = [];
      }
      if (_callback == null) {
        _callback = function(error) {};
      }
      timer = new Metrics.Timer("docManager.acceptChanges");
      callback = function() {
        var args;
        args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
        timer.done();
        return _callback.apply(null, args);
      };
      return DocumentManager.getDoc(project_id, doc_id, function(error, lines, version, ranges) {
        if (error != null) {
          return callback(error);
        }
        if ((lines == null) || (version == null)) {
          return callback(new Errors.NotFoundError("document not found: " + doc_id));
        }
        return RangesManager.acceptChanges(change_ids, ranges, function(error, new_ranges) {
          if (error != null) {
            return callback(error);
          }
          return RedisManager.updateDocument(project_id, doc_id, lines, version, [], new_ranges, {}, function(error) {
            if (error != null) {
              return callback(error);
            }
            return callback();
          });
        });
      });
    },
    deleteComment: function(project_id, doc_id, comment_id, _callback) {
      var callback, timer;
      if (_callback == null) {
        _callback = function(error) {};
      }
      timer = new Metrics.Timer("docManager.deleteComment");
      callback = function() {
        var args;
        args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
        timer.done();
        return _callback.apply(null, args);
      };
      return DocumentManager.getDoc(project_id, doc_id, function(error, lines, version, ranges) {
        if (error != null) {
          return callback(error);
        }
        if ((lines == null) || (version == null)) {
          return callback(new Errors.NotFoundError("document not found: " + doc_id));
        }
        return RangesManager.deleteComment(comment_id, ranges, function(error, new_ranges) {
          if (error != null) {
            return callback(error);
          }
          return RedisManager.updateDocument(project_id, doc_id, lines, version, [], new_ranges, {}, function(error) {
            if (error != null) {
              return callback(error);
            }
            return callback();
          });
        });
      });
    },
    renameDoc: function(project_id, doc_id, user_id, update, projectHistoryId, _callback) {
      var callback, timer;
      if (_callback == null) {
        _callback = function(error) {};
      }
      timer = new Metrics.Timer("docManager.updateProject");
      callback = function() {
        var args;
        args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
        timer.done();
        return _callback.apply(null, args);
      };
      return RedisManager.renameDoc(project_id, doc_id, user_id, update, projectHistoryId, callback);
    },
    getDocAndFlushIfOld: function(project_id, doc_id, callback) {
      if (callback == null) {
        callback = function(error, doc) {};
      }
      return DocumentManager.getDoc(project_id, doc_id, function(error, lines, version, ranges, pathname, projectHistoryId, unflushedTime, alreadyLoaded) {
        if (error != null) {
          return callback(error);
        }
        if (alreadyLoaded && (unflushedTime != null) && (Date.now() - unflushedTime) > MAX_UNFLUSHED_AGE) {
          return DocumentManager.flushDocIfLoaded(project_id, doc_id, function(error) {
            if (error != null) {
              return callback(error);
            }
            return callback(null, lines, version);
          });
        } else {
          return callback(null, lines, version);
        }
      });
    },
    resyncDocContents: function(project_id, doc_id, callback) {
      logger.log({
        project_id: project_id,
        doc_id: doc_id
      }, "start resyncing doc contents");
      return RedisManager.getDoc(project_id, doc_id, function(error, lines, version, ranges, pathname, projectHistoryId) {
        if (error != null) {
          return callback(error);
        }
        if ((lines == null) || (version == null)) {
          logger.log({
            project_id: project_id,
            doc_id: doc_id
          }, "resyncing doc contents - not found in redis - retrieving from web");
          return PersistenceManager.getDoc(project_id, doc_id, function(error, lines, version, ranges, pathname, projectHistoryId) {
            if (error != null) {
              logger.error({
                project_id: project_id,
                doc_id: doc_id,
                getDocError: error
              }, "resyncing doc contents - error retrieving from web");
              return callback(error);
            }
            return ProjectHistoryRedisManager.queueResyncDocContent(project_id, projectHistoryId, doc_id, lines, version, pathname, callback);
          });
        } else {
          logger.log({
            project_id: project_id,
            doc_id: doc_id
          }, "resyncing doc contents - doc in redis - will queue in redis");
          return ProjectHistoryRedisManager.queueResyncDocContent(project_id, projectHistoryId, doc_id, lines, version, pathname, callback);
        }
      });
    },
    getDocWithLock: function(project_id, doc_id, callback) {
      var UpdateManager;
      if (callback == null) {
        callback = function(error, lines, version) {};
      }
      UpdateManager = require("./UpdateManager");
      return UpdateManager.lockUpdatesAndDo(DocumentManager.getDoc, project_id, doc_id, callback);
    },
    getDocAndRecentOpsWithLock: function(project_id, doc_id, fromVersion, callback) {
      var UpdateManager;
      if (callback == null) {
        callback = function(error, lines, version, ops, ranges, pathname, projectHistoryId) {};
      }
      UpdateManager = require("./UpdateManager");
      return UpdateManager.lockUpdatesAndDo(DocumentManager.getDocAndRecentOps, project_id, doc_id, fromVersion, callback);
    },
    getDocAndFlushIfOldWithLock: function(project_id, doc_id, callback) {
      var UpdateManager;
      if (callback == null) {
        callback = function(error, doc) {};
      }
      UpdateManager = require("./UpdateManager");
      return UpdateManager.lockUpdatesAndDo(DocumentManager.getDocAndFlushIfOld, project_id, doc_id, callback);
    },
    setDocWithLock: function(project_id, doc_id, lines, source, user_id, undoing, callback) {
      var UpdateManager;
      if (callback == null) {
        callback = function(error) {};
      }
      UpdateManager = require("./UpdateManager");
      return UpdateManager.lockUpdatesAndDo(DocumentManager.setDoc, project_id, doc_id, lines, source, user_id, undoing, callback);
    },
    flushDocIfLoadedWithLock: function(project_id, doc_id, callback) {
      var UpdateManager;
      if (callback == null) {
        callback = function(error) {};
      }
      UpdateManager = require("./UpdateManager");
      return UpdateManager.lockUpdatesAndDo(DocumentManager.flushDocIfLoaded, project_id, doc_id, callback);
    },
    flushAndDeleteDocWithLock: function(project_id, doc_id, callback) {
      var UpdateManager;
      if (callback == null) {
        callback = function(error) {};
      }
      UpdateManager = require("./UpdateManager");
      return UpdateManager.lockUpdatesAndDo(DocumentManager.flushAndDeleteDoc, project_id, doc_id, callback);
    },
    acceptChangesWithLock: function(project_id, doc_id, change_ids, callback) {
      var UpdateManager;
      if (callback == null) {
        callback = function(error) {};
      }
      UpdateManager = require("./UpdateManager");
      return UpdateManager.lockUpdatesAndDo(DocumentManager.acceptChanges, project_id, doc_id, change_ids, callback);
    },
    deleteCommentWithLock: function(project_id, doc_id, thread_id, callback) {
      var UpdateManager;
      if (callback == null) {
        callback = function(error) {};
      }
      UpdateManager = require("./UpdateManager");
      return UpdateManager.lockUpdatesAndDo(DocumentManager.deleteComment, project_id, doc_id, thread_id, callback);
    },
    renameDocWithLock: function(project_id, doc_id, user_id, update, projectHistoryId, callback) {
      var UpdateManager;
      if (callback == null) {
        callback = function(error) {};
      }
      UpdateManager = require("./UpdateManager");
      return UpdateManager.lockUpdatesAndDo(DocumentManager.renameDoc, project_id, doc_id, user_id, update, projectHistoryId, callback);
    },
    resyncDocContentsWithLock: function(project_id, doc_id, callback) {
      var UpdateManager;
      if (callback == null) {
        callback = function(error) {};
      }
      UpdateManager = require("./UpdateManager");
      return UpdateManager.lockUpdatesAndDo(DocumentManager.resyncDocContents, project_id, doc_id, callback);
    }
  };

}).call(this);

//# sourceMappingURL=DocumentManager.map