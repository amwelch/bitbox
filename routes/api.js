var ec = require('./error-codes');
var pg = require('pg');
var poolModule = require('generic-pool');
/* New deps, will move them up after code is finalized */
var sprintf = require("sprintf-js").sprintf; 
var crypto = require('crypto');
var http = require('http');
var https = require('https');
var pool = poolModule.Pool({

    name: 'postgres',
    
    create: function(callback) {
      //  TOOD: Set connection string using
      //        environment variables
      var connectionString = "pg://alexander:testing123@localhost:5432/bitbox";
      var client = new pg.Client(connectionString);
      client.connect(function(err) {
        callback(err, client);
      });
    },
    
    destroy: function(client) { 
      client.end(); 
    },
    
    max: 10,
    
    // optional. if you set this, make sure to drain() (see step 3)
    // min: 2, 
    
    // specifies how long a resource can stay idle in pool before being removed
    idleTimeoutMillis : 30000,
     
    // if true, logs via console.log - can also be a function
    log: true 

});

var _begin,
_commit, 
_rollback,
_getUser,
_createUser, 
_getOrCreateUser
;

_begin = function(client, callback) {
  client.query("BEGIN", function(err, result) {
    if (err) {
      console.log(err);
      callback(ec.QUERY_ERR, result);
    } else {
      callback(null, result);
    }
  });
};

_commit = function(client, callback) {
  client.query("COMMIT", function(err, result) {
    if (err) {
      console.log(err);
      _rollback(client, ec.QUERY_ERR, callback);
    } else {
      console.log('complete');
      callback(null, result);
    }
  });
};

_rollback = function(client, error_code, callback) {
  console.log("Rolling back");
  console.log(error_code);
  client.query("ROLLBACK", function(err, result) {  
    if (err) {
      console.log(err);
      console.log("WARNING: UNABLE TO ROLL BACK");
    }
    callback(error_code, null);
  });
};


_random = function(len) {
    return crypto.randomBytes(Math.ceil(len/2)).toString('hex').slice(0,len);
}

_getJSON = function(options, onResult){
    var prot = options.port == 443 ? https : http;
    console.log(options);
    var req = prot.request(options, function(res){
        var output = '';
        console.log(options.host + ':' + res.statusCode);
        res.setEncoding('utf8');
        res.on('data', function (chunk){
            output += chunk; 
        });
        res.on('end', function (){
            var obj = JSON.parse(output);
            onResult(res.statusCode, obj);
        });
    });
    req.on('error', function(err) {
        console.log("No go");
        console.log(err);
    });
    req.end();
}
/* Sample response from blockchain

  Response to address creation
  { input_address: '1LsTraiy6PAjbqT83MZFuUx96mN9HmfiS',
  callback_url: 'http://staging.bitbox.mx/deposit/blockchain?uid=1&secret=a3594b9cce57',
  fee_percent: 0,
  destination: '158tK8rpyWWrz4oX1fWeuWkXDV2v8pAgEK' }

*/
_createDepositAddress = function(client, uid, cb) {
    //Random secret for the user
    var secret = _random(12);
    //TODO When domain settles down this becomes domain
    callbackURL = encodeURIComponent(sprintf("http://staging.bitbox.mx/deposit/blockchain?uid=%s&secret=%s", uid, secret));
    //TODO obviously read this from a file containing a cold storage address eventually
    dest_wallet = "158tK8rpyWWrz4oX1fWeuWkXDV2v8pAgEK";
    var options = {
        host: 'blockchain.info',
        port: 443,
        path: sprintf('/api/receive?method=create&address=%s&callback=%s',dest_wallet, callbackURL),
        method: 'GET',
    }
    _getJSON(options, function(statusCode, result){
        if( statusCode != 200 ){
            var err = "ERROR creating address";
            console.log(err);
            cb(err);
        }
        else{
            console.log(result);
            if (! result.input_address){
                console.log("NO RETURNED ADDRESS");
                console.log(result);
                cb("NO RETURNED ADDRESS");
            }
            else{
                /*Update the users db with deposit address and secret */
                var data = [
                   secret, 
                   result.input_address,
                   uid
                ];
                client.query("UPDATE users set secret=$1, deposit_address=$2 where id=$3", data, function(err, result){
                   if (err){
                      console.log("ERROR UPDATING USER");
                      console.log(err);
                      cb("error");
                   }
                   else{
                      console.log("UPDATED USER");
                      cb(null);
                   }
                });
            }
        }
    });
}

_createUser = function(client, data, callback) {
  //  Having an email address from FB is how we determine whether user has auth'd with us
  var account_status = data.email ? "Active" : "Inactive";

  var user = [
    data.email,
    data.firstname,
    data.lastname,
    data.nickname,
    data.facebook_id,
    account_status
  ];

  client.query("INSERT INTO users (email, firstname, lastname, nickname, facebook_id, status) VALUES ($1, $2, $3, $4, $5, $6)", 
    user, 
    function (err, result) { 
      if (err) {
        console.log(err);
        callback(ec.QUERY_ERR, null); 
      } else {
        callback(null, result);
      }
    }
  );
};

exports.getUser = pool.pooled(_getUser = function(client, data, callback) {
  var select = null;
  var values = null;
  
  if (data.id) {
    select = "SELECT * FROM users WHERE id=$1";
    values = [data.id];
  } else if (data.facebook_id) {
    select = "SELECT * FROM users WHERE facebook_id=$1";
    values = [data.facebook_id];
  } else {
    callback(ec.INPUT_ERR);
    return;
  }

  client.query(select, values, function(err, result) {
    if (err) {
      console.log(err);
      callback(ec.QUERY_ERR, null);
    } else if (result.rows.length == 0) {
      callback(ec.USER_NOT_FOUND, null);
    } else if (result.rows.length == 1) {
      var row = result.rows[0];
      var user = {
        id: row.id,
        email: row.email,
        firstname: row.firstname,
        lastname: row.lastname,
        nickname: row.nickname,
        status: row.status,
        created: row.created,
        facebook_id: row.facebook_id,
        deposit_address: row.deposit_address,
        secret: row.secret,
        balance: row.balance
      };
      callback(null, user);
    }
  });
});



exports.getOrCreateUser = pool.pooled(_getOrCreateUser = function(client, data, callback) {
  _getUser(client, data, function(err, result) {
    if (err) {
      _createUser(client, data, function(err, result) {
        if (err) {
          callback(ec.CREATE_USER_ERR, null);
        } else {
          _getUser(client, data, function(err, result) {
            if (err) {
              callback(ec.USER_NOT_FOUND, null);              
            } else {
              console.log("GOT USER");
              console.log(result);
              _createDepositAddress(client, result.id, function(err){
                 if (err){
                   callback(ec.CREATE_ADDRESS_FAIL, null);
                 } 
                 callback(null, result);      
              });
            }
          });
        }
      });
    } else {
      callback(null, result);
    }
  });
});

exports.activateUser = pool.pooled(function(client, user, callback) {
  client.query("UPDATE users SET status = 'Active' WHERE id=$1", [user.id], function(err, result) {
    if (err) {
      console.log(err);
      callback(ec.QUERY_ERR, null);
    } else {
      _getUser(client, user, function() {
        if (err) {
          callback(ec.QUERY_ERR, null);              
        } else {
          callback(null, user);      
        }
      });
    }
  });
});
exports.completeDeposit = pool.pooled(function(client, data, callback) {
   _begin(client, function(err, result) {
     if (err) {
       _rollback(client, err, callback);
     } else {
       client.query("UPDATE transactions set status='complete' where blockchain_id=$1", [data.depositId], function(err, result){
         if (err){
           _rollback(client, err, callback);
         } else {
           _commit(client, callback);
         }
       });
     }
   });
});

exports.createOrUpdateDeposit = pool.pooled(function(client, data, callback) {
  //  START TXN
  _begin(client, function(err, result) {
    if (err) {
      _rollback(client, err, callback);
    } else {
      //  GET SOURCE ACCT
      _getUser(client, data.source, function(err, source) {
        if (err) {
          _rollback(client, err, callback);
        } else {
          //  GET DEST ACCT
          _getOrCreateUser(client, data.destination, function(err, destination) {
            if (err) {
              _rollback(client, err, callback);
            } else {
              client.query("SELECT * FROM transactions where blockchain_id =$1", [data.depositId], function(err, result){
                  if (err || result.rows.length == 0) {
                      console.log("CREATING TRANSACTION");
                      console.log(err);
                     client.query("INSERT INTO transactions (source, destination, amount, memo, type, blockchain_id, confirmations) VALUES ($1, $2, $3, $4, $5, $6, $7)", 
                       [
                         source.id,
                         destination.id,
                         data.amount,
                         data.memo,
                         data.type,
                         data.depositId,
                         data.confirmations,
                       ], 
                       function(err, result) {
                         if (err) {
                           console.log(err);
                           _rollback(client, ec.TRANSFER_ERR, callback);
                         } else {
                           //  END TXN
                           _commit(client, callback);
                         }
                       }
                     );
                  }
                  else if (result.rows.length != 1){
                      console.log("ERROR THIS SHOULD NEVER HAPPEN DUPE DEPOSITS");
                      console.log(result.rows);
                      _rollback(client, ec.TRANSFER_ERR, callback);
                  }
                  else {
                      res = result.rows[0];
                      if (res.confirmations != data.confirmations){
                         client.query("UPDATE transactions set confirmations=$1 where blockchain_id=$2", [data.confirmations, data.depositId], function(err, result){
                     
                             if (err){
                                 console.log(err);
                                 _rollback(client, ec.TRANSFER_ERR, callback);
                             }
                             else{
                                 _commit(client, callback);
                                 console.log("Updated # of confirmations");
                             }
                         });
                      }
                  }
              });
            }
          });
        }
      });
    };
  });
});


exports.transfer = pool.pooled(function(client, data, callback) {
  //  START TXN
  _begin(client, function(err, result) {
    if (err) {
      _rollback(client, err, callback);
    } else {

      //  GET SOURCE ACCT
      _getUser(client, data.source, function(err, source) {
        if (err) {
          _rollback(client, err, callback);
        } else {

          //  GET DEST ACCT
          _getOrCreateUser(client, data.destination, function(err, destination) {
            if (err) {
              _rollback(client, err, callback);
            } else {
              //  TRANSFER FUNDS
              client.query("INSERT INTO transactions (source, destination, amount, memo, type) VALUES ($1, $2, $3, $4, $5)", 
                [
                  source.id,
                  destination.id,
                  data.amount,
                  data.memo,
                  data.type,
                ], 
                function(err, result) {
                  if (err) {
                    console.log(err);
                    _rollback(client, ec.TRANSFER_ERR, callback);
                  } else {
                    
                    //  END TXN
                    _commit(client, callback);
                  }
                }
              );
            }
          });
        }
      });
    }
  });
});

exports.track = pool.pooled(function(client, id, callback) {
  id = parseInt(id);
  client.query("SELECT transactions.*, source.nickname AS source_name, destination.nickname AS destination_name "+
    "FROM transactions "+
    "LEFT OUTER JOIN users source ON transactions.source=source.id "+
    "LEFT OUTER JOIN users destination ON transactions.destination=destination.id "+
    "WHERE source=$1 OR destination=$1 "+
    "ORDER BY transactions.submitted DESC", [id], function(err, result) {
    if (err) {
      console.log(err);
      callback(ec.QUERY_ERR, null);
    } else { 
      var rValue = [];
      var history = result.rows;
      for (var i = 0; i < history.length; ++i) {
        if (history[i].source == id) {
          rValue.push({
            date: history[i].submitted,
            action: history[i].type,
            whom: history[i].destination_name ? history[i].destination_name : "FB friend",
            status: history[i].status,
            amount: history[i].amount,
            confirmations: history[i].confirmations,
            memo: history[i].memo
          });
        } else if (history[i].destination == id) {
          rValue.push({
            date: history[i].submitted,
            action: history[i].type,
            whom: history[i].source_name ? history[i].source_name : "FB friend",
            status: history[i].status,
            amount: history[i].amount,
            confirmations: history[i].confirmations,
            memo: history[i].memo
          });
        }
      }
      callback(null, rValue);
    }
  });
});
