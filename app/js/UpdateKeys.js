// Generated by CoffeeScript 1.7.1
(function() {
  module.exports = {
    combineProjectIdAndDocId: function(project_id, doc_id) {
      return "" + project_id + ":" + doc_id;
    },
    splitProjectIdAndDocId: function(project_and_doc_id) {
      return project_and_doc_id.split(":");
    }
  };

}).call(this);

//# sourceMappingURL=UpdateKeys.map