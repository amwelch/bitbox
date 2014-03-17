var ec = require('./error-codes');
var pg = require('pg');
var poolModule = require('generic-pool');
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
_transfer,
_passportToUser,
_getUserByUserId,
_getUserByEmail, 
_getUserByFBId,
_createUserByFB, 
_createUserByFBId,
_getOrCreateUserByFB,
_getOrCreateUserByFBId
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

_passportToUser = function(profile) {
  //  TODO: error check passport data (if necessary?)
  var user = [
    profile.emails[0].value,
    profile.name.givenName,
    profile.name.familyName,
    profile.name.givenName + " " + profile.name.familyName,
    profile.id.toString()
  ];
  return user;
}

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

_createUserByFBId = function(client, facebook_id, nickname, callback) {
  client.query("INSERT INTO users (facebook_id, status, nickname) VALUES ($1, 'Inactive', $2)", [facebook_id, nickname], function(err, result) {
    if (err) {
      console.log(err);
      callback(ec.QUERY_ERR, null);
    } else {
      callback(null, result);
    }
  });
};

_getUserByEmail = function(client, email, callback) {
  client.query("SELECT * FROM users WHERE email=$1", [email], function(err, result) {
    if (err) {
      console.log(err);
      callback(ec.QUERY_ERR, null);
    } else if (result.rows.length == 0) {
      //  User not found
      callback(ec.GET_USER_ERR, null);
    } else if (result.rows.length == 1) {
      user = result.rows[0];
      callback(null, user);
    }
  });
};

_createUserByFB = function(client, passport_profile, callback) {
  var user = _passportToUser(passport_profile);
  client.query("INSERT INTO users (email, firstname, lastname, nickname, facebook_id, status) VALUES ($1, $2, $3, $4, $5, 'Active')", 
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

_getUserByFBId = function(client, facebook_id, callback) {
  client.query("SELECT * FROM users WHERE facebook_id=$1", [facebook_id], function(err, result) {
    if (err) {
      console.log(err);
      callback(ec.QUERY_ERR, null);
    } else if (result.rows.length == 0) {
      //  User not found
      callback(ec.GET_USER_ERR, null);
    } else if (result.rows.length == 1) {
      user = result.rows[0];
      callback(null, user);
    }
  });
};

exports.getUserByUserId = pool.pooled(_getUserByUserId = function(client, user_id, callback) {
  client.query("SELECT * FROM users WHERE id=$1", [user_id], function(err, result) {
    if (err) {
      console.log(err);
      callback(ec.QUERY_ERR, null);
    } else if (result.rows.length == 0) {
      //  User not found
      callback(ec.GET_USER_ERR, null);
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
        balance: row.balance
      };
      callback(null, user);
    }
  });
});

exports.getOrCreateUserByFB = pool.pooled(_getOrCreateUserByFB = function(client, profile, callback) {
  _getUserByEmail(client, profile.emails[0].value, function(err, result) {
    if (err) {
      _createUserByFB(client, profile, function(err, result) {
        if (err) {
          //  Unable to create FB user
          callback(ec.CREATE_USER_ERR, null);
        } else {
          _getUserByEmail(client, profile.emails[0].value, function(err, result) {
            if (err) {
              //  Unable to find created FB user
              callback(ec.GET_USER_ERR, null);              
            } else {
              callback(null, result);      
            }
          });
        }
      });
    } else {
      callback(null, result);
    }
  });
});

exports.getOrCreateUserByFBId = pool.pooled(_getOrCreateUserByFBId = function(client, facebook_id, nickname, callback) {
  _getUserByFBId(client, facebook_id, function(err, result) {
    if (err) {
      _createUserByFBId(client, facebook_id, nickname, function(err, result) {
        if (err) {

          //  Unable to create FB identity
          callback(ec.CREATE_USER_ERR, null);
        } else {
          _getUserByFBId(client, facebook_id, function(err, result) {
            if (err) {
              //  Unable to find created FB identity
              callback(ec.GET_USER_ERR, null);
            } else {
              callback(null, result);
            }
          });
        }
      });
    } else {
      callback(null, result);
    }
  });
});

_transfer = function(client, form, callback) {

  //  START TXN
  _begin(client, function(err, result) {
    if (err) {
      _rollback(client, err, callback);
    } else {
      //  GET SOURCE ACCT
      console.log(form);
      _getUserByUserId(client, form.source_id, function(err, source) {
        if (err) {
          _rollback(client, err, callback);
        } else {
          console.log(source);
          //  GET DEST ACCT
          _getOrCreateUserByFBId(client, form.destination_fbid, form.nickname, function(err, destination) {
            if (err) {
              _rollback(client, err, callback);
            } else {
              //  TRANSFER FUNDS
              client.query("INSERT INTO transactions (source, destination, amount, memo, type) VALUES ($1, $2, $3, $4, $5)", 
                [
                  source.id,
                  destination.id,
                  form.amount,
                  form.memo,
                  form.type
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
};

exports.pay = pool.pooled(function(client, form, callback) {
  form.type = "Payment";
  _transfer(client, form, function(err, result) {
    callback(err, result);
  });
});

exports.withdraw = pool.pooled(function(client, form, callback) {
  form.type = "Withdrawal";
  form.destination_fbid = 1;
  _transfer(client, form, function(err, result) {
    if (err) {
      callback(ec.QUERY_ERR, null);
    } else {
      callback(null, result);
    }
  });
});

exports.deposit = pool.pooled(function(client, form, callback) {
  form.type = "Deposit";
  form.source_id = 1;
  form.memo = "Address: 31uEbMgunupShBVTewXjtqbBv5MndwfXhb";
  _transfer(client, form, function(err, result) {
    if (err) {
      callback(ec.QUERY_ERR, null);
    } else {
      callback(null, result);
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
            memo: history[i].memo
          });
        } else if (history[i].destination == id) {
          rValue.push({
            date: history[i].submitted,
            action: history[i].type,
            whom: history[i].source_name ? history[i].source_name : "FB friend",
            status: history[i].status,
            amount: history[i].amount,
            memo: history[i].memo
          });
        }
      }
      callback(null, rValue);
    }
  });
})
