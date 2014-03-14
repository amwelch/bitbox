
/*
 * HELPER FUNCTIONS
 */

function render(res, content) {
  var params = {};

  for (var key in content) {
    // important check that this is objects own property 
    // not from prototype prop inherited
    if(content.hasOwnProperty(key)) {
      params[key] = content[key];
    }
  }

  res.render('index', params);

};

function logged_in(req) {
  var rValue = false;
  if (req.session['passport'] && req.session['passport'].user) {
    rValue = true;
  }
  return rValue;
}

var rollback = function(client, done, err_in) {
  console.error(err_in);
  client.query('ROLLBACK', function(err) {
  	console.log("Rolling back!!");
  	console.log(err);
    //if there was a problem rolling back the query
    //something is seriously messed up.  Return the error
    //to the done function to close & remove this client from
    //the pool.  If you leave a client in the pool with an unaborted
    //transaction __very bad things__ will happen.
    return done(err);
  });
};

function db_query(res, query, render_content) {
  var pg = require('pg');
  var dbUrl = "pg://alexander:testing123@localhost:5432/bitbox"
  pg.connect(dbUrl, function(err, client, done) {
    client.query(query, function(err, result){
        console.log("got query");
        if (err){
          // If there is an error the user is prompted with a
          // screen that gives some info. 
          console.log("ERROR:", err);          
          render_content.ok = 'error';
          render(res, render_content);          
        }
        else if (result.rows.length < 1) {
          console.log("ERROR: bad length "+ result.rows.length);
          render_content.ok = 'no_results';
          render(res, render_content);
        }
        else {
          console.log("got query result");          
          render_content.ok = 'ok';
          render_content.data = result.rows
          render(res, render_content);
        }
    })
    done();
  });  
}

/*
 * HOMEPAGE
 */
exports.index = function(req, res){
  render(res, {
    base: 'index',
    view: 'index',
    authenticated: logged_in(req),
    title: 'Social Bitcoin'
  });
};

exports.login = function(req, res){
  if (logged_in(req)) {
    render(res, {
      base: 'index',
      view: 'index',
      authenticated: true,
      title: 'Social Bitcoin'
    });
  } else {
    render(res, {
      base: 'index',
      view: 'login',
      authenticated: false,
      title: 'Login'
    });
  }
};

function transaction(usr_id, tx_data) {
  // This query is to check if the dst exists or not in our DB
  var dst_query = {text:"SELECT id, accountstate FROM users WHERE fbid=$1", values:[tx_data.fbid]};  
  var partial_usr_query = {text:"INSERT INTO users(fbid, email, accountstate) "+
                                "VALUES($1,$2,'Inactive')", values:[tx_data.fbid,tx_data.fbid]};  
  var balance_query = {text:"SELECT bits FROM balances WHERE id=$1", values:[usr_id]};

  var tx_query = "INSERT INTO transactions "+
                 "(srcaccount, dstaccount, status, type, bits, memo) "+
                 "VALUES($1,$2,$3,$4,$5,$6)";


  var pg = require('pg');
  var dbUrl = "pg://alexander:testing123@localhost:5432/bitbox"
  pg.connect(dbUrl, function(err, client, done) {
    // Check if the user we are trying to pay/charge
    // exists or not.
    client.query(dst_query, function(err, result){
      if (err){
        // There is an error with the query 
        console.log("ERROR:", err);                              
      } // ERROR      
      else if (result.rows.length < 1) {
        // The dst user doesn't exist
        console.log("User doesn't exist"); 

        // Strat transaction
        client.query('BEGIN', function(err) {
          if(err) return rollback(client, done); 
          process.nextTick(function() {     

            // Create partial user in the db
            client.query(partial_usr_query, function(err) {
              if(err) return rollback(client, done, err);

              // Get new user id
              client.query(dst_query, function(err, result) {              
                if (err) return rollback(client, done, err);
                var dst_id = result.rows[0].id;

                // TODO: Insert new balance row for this dst_usr?

                // Insert pending transaction                
                client.query(tx_query, [usr_id, dst_id, 'Pending', tx_data.op, tx_data.bits, tx_data.memo],
                  function(err) {
                  if(err) return rollback(client, done, err);
                  client.query('COMMIT', done);
                });               
              });
            });
          });      
        });
      } // if (result.rows.length < 1)
      else {        
        // The dst user exists, proceed with transaction
        console.log("Dst User exists proceed with transaction");
        var dst_id = result.rows[0].id;
        var dst_state = result.rows[0].accountstate;

        // Are we paying or charging
        if(tx_data.op == 'Pay') {
          // Check if the user can pay
          // TODO: should we just cache the balance?
          client.query(balance_query, function(err, result){
            if (err) console.log("ERROR:", err);
            var balance = result.rows[0].bits;

            // Check if user has enough money
            if(balance >= tx_data.bits) {
              // Is the dst active?
              if(dst_state == 'Active') {
                // Strat transaction
                client.query('BEGIN', function(err) {
                  if(err) return rollback(client, done); 
                  process.nextTick(function() {                                                                 
                    client.query(tx_query, [usr_id, dst_id, 'Approved', tx_data.op, tx_data.bits, tx_data.memo],
                      function(err) {
                      if(err) return rollback(client, done, err);

                      var balance_query = 'UPDATE balances SET bits = bits + $1 WHERE id = $2';
                      var neg_bits = tx_data.bits * -1;
                      client.query(balance_query, [neg_bits, usr_id], function(err) {
                        if(err) return rollback(client, done, err);
                        
                        client.query(balance_query, [tx_data.bits, dst_id], function(err) {
                          if(err) return rollback(client, done, err);
                          client.query('COMMIT', done);
                        });
                      });
                    });
                  });
                });
              } // if(dst_state == 'Active')
              else {
                // If the user is not active add a pending transaction
                // Strat transaction
                client.query('BEGIN', function(err) {
                  if(err) return rollback(client, done); 
                  process.nextTick(function() {
                    // Insert pending transaction                                                                     
                    client.query(tx_query, [usr_id, dst_id, 'Pending', tx_data.op, tx_data.bits, tx_data.memo],
                      function(err) {
                      if(err) return rollback(client, done, err);
                      client.query('COMMIT', done);
                    });               
                  });
                });                
              } // else
            } // if(balance >= tx_data.bits) 
            else {
              // The user doesn't have enough money to pay!
              // TODO: should we even allow the user to submit 
              // a transaction if he doesn't have enough money,
              // maybe pop an alert to the user? 

              // Strat transaction
              client.query('BEGIN', function(err) {
                if(err) return rollback(client, done); 
                process.nextTick(function() {
                  // Insert pending transaction                                                                     
                  client.query(tx_query, [usr_id, dst_id, 'Declined', tx_data.op, tx_data.bits, tx_data.memo],
                    function(err) {
                    if(err) return rollback(client, done, err);
                    client.query('COMMIT', done);
                  });               
                });
              });
            } // else
          });
        } // if(tx_data.op == 'Pay')
        else {
          // TODO: notify dst_user that there is a charge request
          // For now just add a pending transaction
          
          // Strat transaction
          client.query('BEGIN', function(err) {
            if(err) return rollback(client, done); 
            process.nextTick(function() {
              // Insert pending transaction                                                                     
              client.query(tx_query, [usr_id, dst_id, 'Pending', tx_data.op, tx_data.bits, tx_data.memo],
                function(err) {
                if(err) return rollback(client, done, err);
                client.query('COMMIT', done);
              });               
            });
          });
        } // else
      } // else
    });    
  });
}

/*
 * TRANSFER
 */
exports.process_transaction = function(req, res) {
  if (logged_in(req)) {
    //TODO: do we need more security checks here
    // to make sure this is a legit post request?
    console.log("------------->>>> POST Transfer");    

    var fields = exports.mergeDict(req.body, req.user);    
    var usr_id = fields["id"];

    transaction(usr_id, req.body.tx);

    res.redirect('/transfer/pay');
  }
  else {
    res.redirect('/liftoff/login');
  }
}

exports.pay = function(req, res){
  if (logged_in(req)) {      
    console.log("------------->>>> GET Transfer");

    var fields = exports.mergeDict(req.body, req.user);    
    var id = fields["id"];

    // TODO: do we want to fetch the balance from the db every time?
    // Possible race condition when transaction is being executed. 
    var query = {text:"SELECT bits FROM balances WHERE id=$1", values:[id]};

    var render_content = {
      base: 'transfer',
      view: 'pay',
      authenticated: true,
      title: 'Pay',
      header: 'Payment'      
    }    

    db_query(res, query, render_content);

  } else {
    res.redirect('/liftoff/login');
  }
};

exports.withdraw = function(req, res){
  if (logged_in(req)) {
    render(res, {
      base: 'transfer',
      view: 'withdraw',
      authenticated: true,
      title: 'Pay'
    })
  } else {
    res.redirect('/liftoff/login');
  }
};

exports.deposit = function(req, res){
  if (logged_in(req)) {
    render(res, {

      base: 'transfer',
      view: 'deposit',
      authenticated: true,
      title: 'Deposit'
    })
  } else {
    res.redirect('/liftoff/login');
  }
};

/*
 * HISTORY
 */
exports.track = function(req, res){
  if (logged_in(req)) {
    console.log("------------->>>> GET History");

    var fields = exports.mergeDict(req.body, req.user);    
    var id = fields["id"];

    // TODO: this could have a sql
    var query = "SELECT t.submitted, u1.firstname as src, u2.firstname as dst, " +
                        "t.status, t.type, t.bits, t.srcaccount, t.dstaccount " +
                 "FROM (SELECT submitted, srcaccount, dstaccount, status, type, bits " +
                       "FROM transactions " +
                       "WHERE srcaccount="+id+" OR dstaccount="+id+") as t " +
                 "INNER JOIN users u1 on t.srcaccount = u1.id " +
                 "INNER JOIN users u2 on t.dstaccount = u2.id " +
                 "ORDER BY t.submitted DESC;" 
    
    render_content = {
      base: 'transfer',
      view: 'track',
      header: 'Transaction Overview',      
      authenticated: true,
      title: 'Track',        
      from: 'From',
      type: 'Type',
      to: 'To',
      status: 'Status',
      gross: 'Gross',
      date: 'Date'
    };

    db_query(res, query, render_content) 

  } else {
    res.redirect('/liftoff/login');
  }
};

/*
 * ///HISTORY
 */

/* Account */
exports.create_user= function(fields){
    exports.user_update_db(fields, true);
}

/*Get user by email*/
exports.get_user = function(email, passport_info, cb, done){
  var pg = require('pg');
  var dbUrl = "pg://alexander:testing123@localhost:5432/bitbox"
  // TODO: possible sql injection!
  var queryStr = "SELECT * FROM users where email='"+email+"';"
  pg.connect(dbUrl, function(err, client, pg_done) {
      client.query(queryStr, function(err, result){
          if (err){
            console.log("ERROR:", err);
          }
          else if (result.rows.length != 1){
            console.log("ERROR: bad length "+ result.rows.length);
            data = undefined;
          }
          else{
            data = result.rows[0];
          }
          cb(data, passport_info, done);
          client.end();
      });
      //Close the connection
  });

}

exports.user_update_db= function(fields, new_account){
  /*TODO: Keep around connection so we don't re-auth every time*/
  var pg = require('pg');
  var first = true;
  var fbID = fields["fbid"];

  console.log(fields);

  var updateStr = "";
  var keyStr = "fbid";
  var valueStr = fbID;
  for(var f in fields){
    if (fields[f] == undefined || f =="fbid" || fields[f] == "id"){
        continue;
    }
    valueStr += ",";
    keyStr += ",";
    if (!first){
      updateStr += ",";
    }
    else{
      first = false;
    }
    keyStr += f;
    valueStr += "'" + fields[f] + "'";
    updateStr += " "+f+"="+"'"+fields[f]+"'";
  }
  var query = "";
  if (new_account){
    //TODO: This could have a sql injection!
      query = "INSERT into users ("+keyStr+") VALUES("+valueStr+");";
  }
  else{
      query = "UPDATE users SET " + updateStr + " WHERE fbid="+fbID+";";
  }
  console.log(query);
  var dbUrl = "pg://alexander:testing123@localhost:5432/bitbox"
  pg.connect(dbUrl, function(err, client, done) {
    if(err)
        consle.log(err);
    client.query('BEGIN', function(err) {
        if(err)
            return rollback(client, done);
      process.nextTick(function() {
        client.query(query, [], function(err) {
          if(err) {
          	console.error(err);
          	return rollback(client, done);
          }

          client.query('COMMIT', done);

          // // Get user id and add a row to balance as well          
          // var id_query = {text:"SELECT id FROM users WHERE email=$1", values:[fields.email]};  
          // client.query(id_query, function(err, result) {              
          //   if (err) return rollback(client, done, err);
          //   var id = result.rows[0].id;
          //   var b_query = {text:"INSERT INTO balances(id, bits) values($1,0)", values:[id]};  
            
          //   // Insert balance row
          //   client.query(b_query, function(err) {
          //     if (err) return rollback(client, done, err);
          //     client.query('COMMIT', done);	          
          //   });
          // });
        });
      });
    });
  });


}
/*Merge two associative arrays in case of a dupe d1 key will win*/
exports.mergeDict= function(d1, d2){
    for (k in d2){
        if(d1[k] == undefined)
            d1[k] = d2[k]
    }
    return d1;
}

exports.userUpdate= function(req, res){
  if (logged_in(req)) {

      fields = exports.mergeDict(req.body, req.user);
      console.log(fields);
      exports.user_update_db(fields);

      console.log("Old user: ", req.user);
      var user = req.user;
      /*Update the user information in passport*/
      for (k in fields){
          user[k] = fields[k];
      }
      user["update"] = true;
      console.log("New user", req.user);
      req.logIn(user, function(err){
          if(err){
              console.log("ERROR: ", err);
          }
          else{
              console.log("Worked!!!");
          }
      });
      res.redirect('/accounts/user');
  } else {
    res.redirect('/liftoff/login');
  }
};
exports.identityUpdate= function(req, res){
  if (logged_in(req)) {
      res.redirect('/accounts/identity');
  } else {
    res.redirect('/liftoff/login');
  }
};
exports.securityUpdate= function(req, res){
  if (logged_in(req)) {
      res.redirect('/accounts/security');
  } else {
    res.redirect('/liftoff/login');
  }
};
exports.userInfo = function(req, res){
  if (logged_in(req)) {
      res.json(req.user);
  } else {
    res.redirect('/liftoff/login');
  }
};
exports.user= function(req, res){
  if (logged_in(req)) {
    render(res, {

      /*TODO for now fetch data for user from db here but in the future we want to fetch this on login and pass it around*/

      base: 'accounts',
      view: 'user',
      title: 'My Account',
      authenticated: true
    })
  } else {
    res.redirect('/liftoff/login');
  }
};
exports.identity= function(req, res){
  if (logged_in(req)) {
    render(res, {

      base: 'accounts',
      view: 'identity',
      title: 'Identity',
      authenticated: true
    })
  } else {
    res.redirect('/liftoff/login');
  }
};
exports.betaEmail = function(req, res){
  /*Where do you want default ui directory to be? Stick it in home for now*/
  var UNAME = "";
  var PW = "";
  require('child_process').exec('python ~/credism/misc/sendMail.py -f '+UNAME+' -t '+req.body.email+' -p '+PW, function(err, stdout, stderr){
    console.log('stdout: ' + stdout);
    console.log('stderr: ' + stderr);
    if (err != null){
      console.log('exec err: ' + err);
    }
  });
};
exports.betaSignUp = function(req, res){
  render(res, {
    base: 'beta',
    view: 'signup',
    title: 'Sorry!',
    authenticated: false
  })
};
exports.security= function(req, res){
  if (logged_in(req)) {
    render(res, {

      base: 'accounts',
      view: 'security',
      title: 'Security',
      authenticated: true
    })
  } else {
    res.redirect('/liftoff/login');
  }
};
