
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

var rollback = function(client, done) {
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
  
}

/*
 * TRANSFER
 */
exports.process_transaction = function(req, res) {
  if (logged_in(req)) {
    //TODO: do we need more security checks here
    // to make sure this is a legit post request?
    console.log("------------->>>> POST Transfer");
    console.log(req.body.tx);
    var tx_data = req.body.tx;

    var fields = exports.mergeDict(req.body, req.user);    
    var usr_id = fields["id"];

    transaction(usr_id, tx_data);

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

    var query = "SELECT bits FROM balances WHERE id="+id+";";

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

    var query = "SELECT t.submitted, u1.firstname as src, u2.firstname as dst, " +
                        "t.completed, t.bits, t.srcaccount, t.dstaccount " +
                 "FROM (SELECT submitted, srcaccount, dstaccount, completed, bits " +
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
      col1: 'Date',
      col2: 'Type',
      col3: 'With',
      col4: 'Status',
      col5: 'Gross'      
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
    if (fields[f] == undefined || f =="id" || f =="fullName"){
    // if (fields[f] == undefined || f =="fbid" || fields[f] == "id"){
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
    //TODO: need to update an empty balance entry into the balance account as well
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
