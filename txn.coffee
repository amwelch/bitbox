class Transaction
    #Unmanaged client (not auto-released)
    @startInClient: (pgClient, releaseOnCompletion, callback) ->
      [callback, releaseOnCompletion] = [releaseOnCompletion, false] if typeof releaseOnCompletion == 'function'
      (new Transaction(pgClient, releaseOnCompletion)).startTransaction callback
 
    #Managed client (auto-released on commit / rollback)
    @start: (callback) ->
      pgPool.acquire (err, pgClient) ->
        return callback(err) if err?
        Transaction.startInClient pgClient, true, callback
 
    constructor: (@pgClient, @releaseOnComplete) ->
 
    startTransaction: (cb) ->
      @pgClient.query "BEGIN", (err) => cb(err, @)
 
    rollback: (cb) ->
      @pgClient.query "ROLLBACK", (err) =>
        pgPool.release @pgClient if @releaseOnComplete
        cb(err, @) if cb?
 
    commit: (cb) ->
      @pgClient.query "COMMIT", (err) =>
        pgPool.release @pgClient if @releaseOnComplete
        cb(err, @) if cb?
 
    wrapCallback: (cb) -> (err) =>
      callerArguments = arguments
      if err?
        @rollback()
        return cb callerArguments...
      else
        @commit (commitErr) ->
          return cb(commitErr) if commitErr?
          cb callerArguments...