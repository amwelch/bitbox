var ec = require('./error-codes');
var sio = require('../routes/socket');
var pg = require('pg');
var cfg = require('../config.js')(ENVIRONMENT);
var poolModule = require('generic-pool');
var sprintf = require("sprintf-js").sprintf; 
var crypto = require('crypto');
var http = require('http');
var fb = require('fb');
var https = require('https');
var uuid = require('node-uuid');

var pool = poolModule.Pool({

    name: 'postgres',
    
    create: function(callback) {
      //  TOOD: Set connection string using
      //        environment variables
      var connectionString = sprintf('%s://%s:%s@%s:%s/bitbox', cfg.db.protocol, cfg.db.username, cfg.db.password, cfg.db.host, cfg.db.port);
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

exports.facebookPost = function(accessToken,body,uid ){
   console.log("Got access " + accessToken);
   fb.setAccessToken(accessToken);
   exports.getUser({id:uid}, function(err, user) {
       if (err){
           console.log("ERROR GETTING USER");
       }
       else{
           console.log("Facebook permission: " + user.facebookPost);
           if (user.facebookPost != true){
               console.log("No Post Permission for this user");
           }
           else{
               fb.api('me/feed', 'post', {message: body}, function (res) {
                   if (!res || res.error){
                       console.log(!res ? 'error occurred' : res.error);
                       return;
                   }
                   console.log("Worked with post id: " + res.id);
               });
           }
       }
   });
}

_random = function(len) {
    return crypto.randomBytes(Math.ceil(len/2)).toString('hex').slice(0,len);
}


/*
https://blockchain.info/merchant/$guid/payment?password=$main_password&to=$address&amount=$amount
$main_password
$to
$amount
*/
exports.withdrawBlockChain = function(addr, amount, cb){
    //TODO Read this from config file
    console.log("CONFIG IS ");
    console.log(cfg);
    var account_pw = cfg.bc.password;
    var account_id = cfg.bc.id;
    var options = {
        host: 'blockchain.info',
        port: 443,
        path: sprintf('/merchant/%s/payment?password=%s&to=%s&amount=%s&',account_id, account_pw, addr, amount),
        method: 'GET',
    }
    _getJSON(options, function(statusCode, result){
        console.log(result);
        if (statusCode != 200){
            console.log("There was an error processing the withdrawl");
            cb("Error");
        }
        else{
            console.log("Went through ok!");
            cb(null);
        }
    });
    
}

exports.queryBlockChain = function(addr, uid){
    url = "http://blockchain.info/address/" + addr + "?format=json";
    var options = {
        host: 'blockchain.info',
        port: 443,
        path: sprintf('/address/%s?format=json',addr),
        method: 'GET',
    }
    _getJSON(options, function(statusCode, result){
        if( statusCode != 200 ){
            var err = "ERROR querying address";
            console.log(err);
            cb(err);
        }
        else{
            console.log("GOT STUFF");
            console.log(result);
 
            /*First check the balance if its 0 then we can end right here*/
            var total = parseInt(result.final_balance);
            if (total == 0){
                console.log("0 balance");
                return;
            }


            //TXNS will be a list
            var txns = result.txs;
            var unmatched_in = [];
            var totals = [];
            var unmatched_out = [];
            for (var i = 0; i < txns.length; i++)
            {        
                var tx = txns[i];
                var id = tx.hash;
                var netResult = parseInt(tx.result);
                var time = parseInt(tx.time);

                if (netResult == 0){
                  continue;
                }
                else if(netResult > 0){
                  unmatched_in.push([id, netResult, time]);
                }
                else{
                  unmatched_out.push([id, netResult, time]);
                }
            }
            var sortFun = function(a,b){
              a = a[2];
              b = b[2];
              return a - b;
            }

            unmatched_in.sort(sortFun);
            unmatched_out.sort(sortFun);
 

            console.log("UNMATCHED_IN ", unmatched_in);
            console.log("UNMATCHED_Out ", unmatched_out);

            var removed = 0;
            //Remove hashes that appear in inputs and outputs
            for (var i =0; i < unmatched_out.length; i++){
                var index = -1;
                for (var j = 0; j < unmatched_in.length; j++){
                  var diff = (parseFloat(unmatched_in[j][1]) / parseFloat(-1*(unmatched_out[i][1])));
                  if ( diff >= .9 && diff <= 1.1){
                    index = j;
                    break;
                  }
                }
                if ( index > -1){
                    unmatched_in.splice(index,1);
                    removed+=1;
                }
            }
            console.log("unmatched out: ", unmatched_out);
            console.log("unmatched in: ",unmatched_in);
            console.log("removed: ", removed);
            if (removed != unmatched_out.length){
                console.log("SOMETHING WRONG, SOME JUNK IN ADDRESS");
                return;
            }
            for (var i = 0; i < unmatched_in.length; i++){
                console.log("THIS IS ID");
                console.log(unmatched_in[i][1]);
                console.log("ADDING UNTRACKED DEPOSIT");
                exports.createOrUpdateDeposit({
                  source: {id: -1},
                  destination: {id: uid},
                  memo: "Deposit to Address: " + addr,
                  type: "Deposit",
                  confirmations: 0,
                  amount: unmatched_in[i][1],
                  depositId: unmatched_in[i][0],
                }, function(err, result){
                    if (err) console.log("ERROR NEW DEPOSIT");
                    else console.log("NO ERROR WITH NEW DEPOSIT");
                });
            }
        }
    });
}
_getJSON = function(options, onResult){
  var prot = options.port == 443 ? https : http;
  console.log("-----OPTIONS-----");
  console.log(options);
  console.log("-----SNOITPO-----");
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
    onResult(res.statusCode, obj);
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
    //  TODO: store secret somewhere
    var secret = _random(12);

    //TODO When domain settles down this becomes domain
    callbackURL = encodeURIComponent(sprintf("%s://%s:%s/deposit/blockchain?uid=%s&secret=%s", cfg.app.protocol, cfg.app.hostname, cfg.app.port, uid, secret));
    
    //TODO make destination cold storage address
    dest_address = cfg.bc.address;
    console.log("DEST ADDRESS IS " + dest_address);
    var options = {
        host: 'blockchain.info',
        port: 443,
        path: sprintf('/api/receive?method=create&address=%s&callback=%s', dest_address, callbackURL),
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
        facebookPost: row.facebookpost,
        balance: row.balance,
        redeemedCode: row.redeemedcode
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
            } else if (ENVIRONMENT == 'dev') {
              callback(null, result);
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
       client.query("UPDATE transactions set status='Complete' where blockchain_id=$1", [data.depositId], function(err, result){
         if (err){
           _rollback(client, err, callback);
         } else {
           _commit(client, callback);
         }
       });
     }
   });
});

exports.updateUser = pool.pooled(function(client, data, callback) {
  _begin(client, function(err, result){
    if (err){
      _rollback(client, err, callback);
    } else {
      client.query("UPDATE users set facebookPost=$1,nickname=$2 where id=$3", [data.facebookPost, data.nickname, data.id], function(err, result){
       if (err){
         console.log("error updating user data");
         _rollback(client, err, callback);
       }
       else{
         console.log("successfully updated user data")
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
                  client.query("INSERT INTO transactions (source, destination, amount, memo, type, blockchain_id, confirmations, uuid) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)", 
                  [
                    source.id,
                    destination.id,
                    data.amount,
                    data.memo,
                    data.type,
                    data.depositId,
                    data.confirmations,
                    uuid.v4()
                  ], 
                  function(err, result) {
                    if (err) {
                     console.log(err);
                     _rollback(client, ec.TRANSFER_ERR, callback);
                    } else {
                     //  END TXN
                     _commit(client, callback);
                    }
                  });
                } else if (result.rows.length != 1) {
                  console.log("ERROR THIS SHOULD NEVER HAPPEN DUPE DEPOSITS");
                  console.log(result.rows);
                  _rollback(client, ec.TRANSFER_ERR, callback);
                } else {
                  res = result.rows[0];
                  if (res.confirmations != data.confirmations){
                    client.query("UPDATE transactions set confirmations=$1 where blockchain_id=$2", 
                    [
                      data.confirmations, 
                      data.depositId
                    ], 
                    function(err, result) {
                      if (err) {
                        console.log(err);
                        _rollback(client, ec.TRANSFER_ERR, callback);
                      } else {
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
      console.log("Error when starting transaction");
      _rollback(client, err, callback);
    } else {

      //  GET SOURCE ACCT
      _getOrCreateUser(client, data.source, function(err, source) {
        if (err) {
          console.log("Error when getting source account in transfer");
          _rollback(client, err, callback);
        } else {

          //  GET DEST ACCT
          _getOrCreateUser(client, data.destination, function(err, destination) {
            if (err) {
              console.log("Error when getting dst account in transfer");
              _rollback(client, err, callback);
            } else {
              var unique_id;
              if(data.tx_uuid) {
                unique_id = data.tx_uuid;
              }
              else {
                unique_id = uuid.v4();
              }
              //  TRANSFER FUNDS
              client.query("INSERT INTO transactions (source, destination, status, amount, memo, type, confirmations, uuid) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)", 
                [
                  source.id,
                  destination.id,
                  data.status,
                  data.amount,
                  data.memo,
                  data.type,
                  -1,
                  unique_id
                ], 
                function(err, result) {
                  if (err) {
                    console.log(err);
                    _rollback(client, ec.TRANSFER_ERR, callback);
                  } else {
                    //  TODO: move these blocks to their respective callbacks 
                    if (data.type == "Withdrawal" && ENVIRONMENT != 'dev' && source.status == "Admin" ){
                      exports.withdrawBlockChain(data.address, data.amount, function(err){
                        if (err){
                          _rollback(client, ec.TRANSFER_ERR, callback);
                        } else {
                          _commit(client, callback);
                        }
                      });  
                    } else if (data.type == "Payment" && data.status == "Pending" && 
                      (source.status == "Active" || source.status == "Admin") && 
                      (destination.status == "Active" || destination.status == "Admin")) {
                      client.query("UPDATE transactions SET status = 'Complete' WHERE uuid = $1", [unique_id], function(err) {
                        if (err){
                          _rollback(client, ec.TRANSFER_ERR, callback);
                        } else {
                          _commit(client, callback);
                        }
                      });
                    } else{
                        //  END TXN
                        _commit(client, callback);
                    }
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

exports.getTransactionByUuid = pool.pooled(function(client, data, callback) {
  client.query("SELECT transactions.*, source.nickname AS source_name, destination.nickname AS destination_name, "+
    "source.facebook_id AS source_fbid, destination.facebook_id AS destination_fbid "+
    "FROM transactions "+
    "LEFT OUTER JOIN users source ON transactions.source=source.id "+
    "LEFT OUTER JOIN users destination ON transactions.destination=destination.id "+
    "WHERE (source=$1 OR destination=$1) AND transactions.uuid = $2", [data.user_id, data.transaction_uuid], function(err, result) {
    if (err) {
      console.log(err);
      callback(err, null);
    } else {
      console.log(result.rows);
      if (result.rows.length == 1) {
        history = result.rows[0];

        client.query("UPDATE notifications SET seen = true WHERE user_id = $1 AND tx_uuid = $2", [data.user_id, data.transaction_uuid], function(err, result) {

          rValue = {
            date: history.last_updated,
            type: history.type,
            source_id: history.source,
            source_name: history.source_name,
            source_fbid: history.source_fbid,
            destination_id: history.destination,
            destination_name: history.destination_name,
            destination_fbid: history.destination_fbid,
            status: history.status,
            amount: history.amount,
            confirmations: history.confirmations,
            memo: history.memo,
            uuid: history.uuid
          };

          client.query("SELECT transaction_logs.generated, transaction_logs.status "+
            "FROM transaction_logs, transactions "+
            "WHERE transactions.uuid=$1 AND transactions.id=transaction_logs.transaction_id "+
            "ORDER BY transaction_logs.id DESC", [data.transaction_uuid], function(err, result) {
              if (err) {
                callback(err, null);
              } else {
                rValue.history = result.rows;
                callback(null, rValue);
              }
          });
        });

      } else {
        callback("INVALID ROW LENGTH", null);
      }
    }
  });
});

exports.getTransactionsByUserId = pool.pooled(function(client, id, callback) {
  client.query("SELECT transactions.*, source.nickname AS source_name, destination.nickname AS destination_name "+
    "FROM transactions "+
    "LEFT OUTER JOIN users source ON transactions.source=source.id "+
    "LEFT OUTER JOIN users destination ON transactions.destination=destination.id "+
    "WHERE source=$1 OR destination=$1 "+
    "ORDER BY transactions.last_updated DESC", [id], function(err, result) {
    if (err) {
      console.log(err);
      callback(ec.QUERY_ERR, null);
    } else { 
      var rValue = [];
      var history = result.rows;
      console.log(history);
      for (var i = 0; i < history.length; ++i) {
        rValue.push({
          date: history[i].last_updated,
          type: history[i].type,
          source_id: history[i].source,
          source_name: history[i].source_name,
          destination_id: history[i].destination,
          destination_name: history[i].destination_name,
          status: history[i].status,
          amount: history[i].amount,
          confirmations: history[i].confirmations,
          memo: history[i].memo,
          uuid: history[i].uuid
        });
      }
      callback(null, rValue);
    }
  });
});

exports.approveTransaction = pool.pooled(function(client, data, callback) {
  client.query("UPDATE transactions SET status = 'Complete' WHERE status = 'Requested' AND transactions.source = $1 AND transactions.uuid=$2", 
  [
    data.user_id, 
    data.transaction_uuid
  ], function(err, result) {
    callback(err, result);
  });
});

exports.declineTransaction = pool.pooled(function(client, data, callback) {
  client.query("UPDATE transactions SET status = 'Declined' WHERE status = 'Requested' AND transactions.source = $1 AND transactions.uuid=$2", 
  [
    data.user_id, 
    data.transaction_uuid
  ], function(err, result) {
    callback(err, result);
  });
});

exports.refundTransaction = pool.pooled(function(client, data, callback) {
  client.query("UPDATE transactions SET status = 'Refunded' WHERE status = 'Complete' AND transactions.destination = $1 AND transactions.uuid=$2", 
  [
    data.user_id, 
    data.transaction_uuid
  ], function(err, result) {
    callback(err, result);
  });
});

exports.cancelTransaction = pool.pooled(function(client, data, callback) {
  client.query("UPDATE transactions SET status = 'Canceled' WHERE status = 'Requested' AND transactions.destination = $1 AND transactions.uuid=$2", 
  [
    data.user_id, 
    data.transaction_uuid
  ], function(err, result) {
    callback(err, result);
  });
});

exports.getNotifications = pool.pooled(function(client, user, callback) {
  console.log("----------------->>>>Inside get notifications");  
  client.query("SELECT * FROM notifications WHERE user_id = $1 ORDER BY id DESC LIMIT 5", [user.id], function(err, result) {
    callback(err, result);
  });  
});

exports.redeem = pool.pooled(function(client, user, callback){
   console.log("HERE?");
   var newBalance = parseInt(data.balance) + 80000;
   console.log("UPDATING USER SETTING BALANCE " + newBalance + " with id " + data.id);
   client.query("UPDATE users set balance=$1,redeemedCode='true' where id=$2", [newBalance, data.id], function(err){ 
     callback(err,null);
   });
});

exports.saveNotification = pool.pooled(function(client, data, callback) {
  console.log("----------------->>>>Saving notification");
  client.query("INSERT INTO notifications (user_id, type, msg, tx_uuid) VALUES ($1,$2,$3,$4)", 
    [
      data.id,
      data.type,
      data.msg,
      data.tx_uuid
    ], function(err) {
      callback(err, null);
  });  
});
