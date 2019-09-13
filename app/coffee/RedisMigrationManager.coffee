logger = require "logger-sharelatex"
Settings = require "settings-sharelatex"
redis = require("redis-sharelatex")

class Multi
	constructor: (@migrationClient) ->
		@command_list = []
		@queueKey = null
	rpush: (args...) ->
		@queueKey = args[0]
		@command_list.push { command:'rpush', args: args}
	setnx: (args...) ->
		@command_list.push { command: 'setnx', args: args}
	exec: (callback) ->
		# decide which client to use
		@migrationClient.findQueue @queueKey, (err, rclient) =>
			return callback(err) if err?
			multi = rclient.multi()
			for entry in @command_list
				multi[entry.command](entry.args...)
			multi.exec callback

class MigrationClient
	constructor: (old_settings, new_settings) ->
		@rclient_old = redis.createClient(old_settings)
		@rclient_new = redis.createClient(new_settings)

	findQueue: (queueKey, callback) ->
		@rclient_old.llen queueKey, (err, result) =>
			return callback(err) if err?
			if result?.length > 0
				logger.debug {queueKey: queueKey}, "pushing to old redis"
				callback(null, @rclient_old)
			else
				logger.debug {queueKey: queueKey}, "pushing to new redis" 
				callback(null, @rclient_new)

	multi: () ->
		new Multi(@)

module.exports = RedisMigrationManager =
	createClient: (args...) ->
		new MigrationClient(args...)