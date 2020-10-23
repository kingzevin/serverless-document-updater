// Generated by CoffeeScript 1.7.1
(function() {
  var DocumentManager, Errors, HistoryManager, Metrics, ProjectHistoryRedisManager, ProjectManager, RedisManager, async, logger,
    __slice = [].slice;

  RedisManager = require("./RedisManager");

  ProjectHistoryRedisManager = require("./ProjectHistoryRedisManager");

  DocumentManager = require("./DocumentManager");

  HistoryManager = require("./HistoryManager");

  async = require("async");

  logger = require("logger-sharelatex");

  Metrics = require("./Metrics");

  Errors = require("./Errors");

  module.exports = ProjectManager = {
    flushProjectWithLocks: function(project_id, _callback) {
      var callback, timer;
      if (_callback == null) {
        _callback = function(error) {};
      }
      timer = new Metrics.Timer("projectManager.flushProjectWithLocks");
      callback = function() {
        var args;
        args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
        timer.done();
        return _callback.apply(null, args);
      };
      return RedisManager.getDocIdsInProject(project_id, function(error, doc_ids) {
        var doc_id, errors, jobs, _fn, _i, _len, _ref;
        if (error != null) {
          return callback(error);
        }
        jobs = [];
        errors = [];
        _ref = doc_ids || [];
        _fn = function(doc_id) {
          return jobs.push(function(callback) {
            return DocumentManager.flushDocIfLoadedWithLock(project_id, doc_id, function(error) {
              if ((error != null) && error instanceof Errors.NotFoundError) {
                logger.warn({
                  err: error,
                  project_id: project_id,
                  doc_id: doc_id
                }, "found deleted doc when flushing");
                return callback();
              } else if (error != null) {
                logger.error({
                  err: error,
                  project_id: project_id,
                  doc_id: doc_id
                }, "error flushing doc");
                errors.push(error);
                return callback();
              } else {
                return callback();
              }
            });
          });
        };
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          doc_id = _ref[_i];
          _fn(doc_id);
        }
        logger.log({
          project_id: project_id,
          doc_ids: doc_ids
        }, "flushing docs");
        return async.series(jobs, function() {
          if (errors.length > 0) {
            return callback(new Error("Errors flushing docs. See log for details"));
          } else {
            return callback(null);
          }
        });
      });
    },
    flushAndDeleteProjectWithLocks: function(project_id, options, _callback) {
      var callback, timer;
      if (_callback == null) {
        _callback = function(error) {};
      }
      timer = new Metrics.Timer("projectManager.flushAndDeleteProjectWithLocks");
      callback = function() {
        var args;
        args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
        timer.done();
        return _callback.apply(null, args);
      };
      return RedisManager.getDocIdsInProject(project_id, function(error, doc_ids) {
        var doc_id, errors, jobs, _fn, _i, _len, _ref;
        if (error != null) {
          return callback(error);
        }
        jobs = [];
        errors = [];
        _ref = doc_ids || [];
        _fn = function(doc_id) {
          return jobs.push(function(callback) {
            return DocumentManager.flushAndDeleteDocWithLock(project_id, doc_id, function(error) {
              if (error != null) {
                logger.error({
                  err: error,
                  project_id: project_id,
                  doc_id: doc_id
                }, "error deleting doc");
                errors.push(error);
              }
              return callback();
            });
          });
        };
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          doc_id = _ref[_i];
          _fn(doc_id);
        }
        logger.log({
          project_id: project_id,
          doc_ids: doc_ids
        }, "deleting docs");
        return async.series(jobs, function() {
          return HistoryManager.flushProjectChanges(project_id, options, function(error) {
            if (errors.length > 0) {
              return callback(new Error("Errors deleting docs. See log for details"));
            } else if (error != null) {
              return callback(error);
            } else {
              return callback(null);
            }
          });
        });
      });
    },
    queueFlushAndDeleteProject: function(project_id, callback) {
      if (callback == null) {
        callback = function(error) {};
      }
      return RedisManager.queueFlushAndDeleteProject(project_id, function(error) {
        if (error != null) {
          logger.error({
            project_id: project_id,
            error: error
          }, "error adding project to flush and delete queue");
          return callback(error);
        }
        Metrics.inc("queued-delete");
        return callback();
      });
    },
    getProjectDocsTimestamps: function(project_id, callback) {
      if (callback == null) {
        callback = function(error) {};
      }
      return RedisManager.getDocIdsInProject(project_id, function(error, doc_ids) {
        if (error != null) {
          return callback(error);
        }
        if (!(doc_ids != null ? doc_ids.length : void 0)) {
          return callback(null, []);
        }
        return RedisManager.getDocTimestamps(doc_ids, function(error, timestamps) {
          if (error != null) {
            return callback(error);
          }
          return callback(null, timestamps);
        });
      });
    },
    getProjectDocsAndFlushIfOld: function(project_id, projectStateHash, excludeVersions, _callback) {
      var callback, timer;
      if (excludeVersions == null) {
        excludeVersions = {};
      }
      if (_callback == null) {
        _callback = function(error, docs) {};
      }
      timer = new Metrics.Timer("projectManager.getProjectDocsAndFlushIfOld");
      callback = function() {
        var args;
        args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
        timer.done();
        return _callback.apply(null, args);
      };
      return RedisManager.checkOrSetProjectState(project_id, projectStateHash, function(error, projectStateChanged) {
        if (error != null) {
          logger.error({
            err: error,
            project_id: project_id
          }, "error getting/setting project state in getProjectDocsAndFlushIfOld");
          return callback(error);
        }
        if (projectStateChanged) {
          return callback(Errors.ProjectStateChangedError("project state changed"));
        }
        return RedisManager.getDocIdsInProject(project_id, function(error, doc_ids) {
          var doc_id, jobs, _fn, _i, _len, _ref;
          if (error != null) {
            logger.error({
              err: error,
              project_id: project_id
            }, "error getting doc ids in getProjectDocs");
            return callback(error);
          }
          jobs = [];
          _ref = doc_ids || [];
          _fn = function(doc_id) {
            return jobs.push(function(cb) {
              return DocumentManager.getDocAndFlushIfOldWithLock(project_id, doc_id, function(err, lines, version) {
                var doc;
                if (err != null) {
                  logger.error({
                    err: err,
                    project_id: project_id,
                    doc_id: doc_id
                  }, "error getting project doc lines in getProjectDocsAndFlushIfOld");
                  return cb(err);
                }
                doc = {
                  _id: doc_id,
                  lines: lines,
                  v: version
                };
                return cb(null, doc);
              });
            });
          };
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            doc_id = _ref[_i];
            _fn(doc_id);
          }
          return async.series(jobs, function(error, docs) {
            if (error != null) {
              return callback(error);
            }
            return callback(null, docs);
          });
        });
      });
    },
    clearProjectState: function(project_id, callback) {
      if (callback == null) {
        callback = function(error) {};
      }
      return RedisManager.clearProjectState(project_id, callback);
    },
    updateProjectWithLocks: function(project_id, projectHistoryId, user_id, docUpdates, fileUpdates, version, _callback) {
      var callback, handleDocUpdate, handleFileUpdate, project_ops_length, project_subversion, project_version, timer;
      if (_callback == null) {
        _callback = function(error) {};
      }
      timer = new Metrics.Timer("projectManager.updateProject");
      callback = function() {
        var args;
        args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
        timer.done();
        return _callback.apply(null, args);
      };
      project_version = version;
      project_subversion = 0;
      project_ops_length = 0;
      handleDocUpdate = function(projectUpdate, cb) {
        var doc_id;
        doc_id = projectUpdate.id;
        projectUpdate.version = "" + project_version + "." + (project_subversion++);
        if (projectUpdate.docLines != null) {
          return ProjectHistoryRedisManager.queueAddEntity(project_id, projectHistoryId, 'doc', doc_id, user_id, projectUpdate, function(error, count) {
            project_ops_length = count;
            return cb(error);
          });
        } else {
          return DocumentManager.renameDocWithLock(project_id, doc_id, user_id, projectUpdate, projectHistoryId, function(error, count) {
            project_ops_length = count;
            return cb(error);
          });
        }
      };
      handleFileUpdate = function(projectUpdate, cb) {
        var file_id;
        file_id = projectUpdate.id;
        projectUpdate.version = "" + project_version + "." + (project_subversion++);
        if (projectUpdate.url != null) {
          return ProjectHistoryRedisManager.queueAddEntity(project_id, projectHistoryId, 'file', file_id, user_id, projectUpdate, function(error, count) {
            project_ops_length = count;
            return cb(error);
          });
        } else {
          return ProjectHistoryRedisManager.queueRenameEntity(project_id, projectHistoryId, 'file', file_id, user_id, projectUpdate, function(error, count) {
            project_ops_length = count;
            return cb(error);
          });
        }
      };
      return async.eachSeries(docUpdates, handleDocUpdate, function(error) {
        if (error != null) {
          return callback(error);
        }
        return async.eachSeries(fileUpdates, handleFileUpdate, function(error) {
          if (error != null) {
            return callback(error);
          }
          if (HistoryManager.shouldFlushHistoryOps(project_ops_length, docUpdates.length + fileUpdates.length, HistoryManager.FLUSH_PROJECT_EVERY_N_OPS)) {
            HistoryManager.flushProjectChangesAsync(project_id);
          }
          return callback();
        });
      });
    }
  };

}).call(this);

//# sourceMappingURL=ProjectManager.map