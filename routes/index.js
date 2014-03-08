
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

/*
 * TRANSFER
 */
exports.transfer = function(req, res){
  if (logged_in(req)) {
    render(res, {
      base: 'transfer',
      view: 'pay',
      authenticated: true,
      title: 'Pay'
    })
  } else {
    res.redirect('/liftoff/login');
  }
}

exports.pay = function(req, res){
  if (logged_in(req)) {
    render(res, {
      base: 'transfer',
      view: 'pay',
      authenticated: true,
      title: 'Pay'
    })
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
function db_query(query_str) {
  var pg = require('pg');
  var dbUrl = "pg://alexander:testing123@localhost:5432/bitbox"
  var query_result;
  pg.connect(dbUrl, function(err, client, done) {
    console.log("Connected to DB sending query");
    query_result = client.query(query);    
    done();
  }
  console.log(query_result);
}

function db_transaction(query, work_result) {
  var pg = require('pg');
  var dbUrl = "pg://alexander:testing123@localhost:5432/bitbox"
  var r_result;
  pg.connect(dbUrl, function(err, client, done) {
      console.log("GOT CONNECTION!");
      var id;
      client.query(query, function(err, result){
          console.log("WOOT GOT QUERY");
          if (err){
            console.log("ERROR:", err);
          }
          else if (result.rows.length != 1){
            console.log("ERROR: bad length "+ result.rows.length);
            data = undefined;
          }
          else{
            console.log("WOO RETURNING");
            work_result(result);
          }          
      });
  });  
}

function get_transactions() {
  
}

function get_id(result) {
  // var id = 
}

function transactions_data(fbID){
  console.log("getting transactions...");

  // TODO: we shouldn't need to get the id from the db. 
  var queryId =  "SELECT id FROM users WHERE fbid="+fbID+";"
  var id = db_query(queryId);
  console.log(id);
  if(!id) {
    console.log("DB error couldn't get user id");
    return;
  }
  var queryStrT= "SELECT t.submitted, u1.firstname as src, u2.firstname as dst," +
                        "t.completed, t.bits, t.srcaccount, t.dstaccount" +
                 "FROM (SELECT submitted, srcaccount, dstaccount, completed, bits" +
                       "FROM transactions" +
                       "WHERE srcaccount="+id+" OR dstaccount="+id+") as t" +
                 "INNER JOIN users u1 on t.srcaccount = u1.id" +
                 "INNER JOIN users u2 on t.dstaccount = u2.id;"
  var transactions = db_query(queryStrT);
  console.log(transactions);
}

exports.track = function(req, res){
  if (logged_in(req)) {
    console.log("----------->Starting transaction retrieval");
    
    var user_transactions = [
        ['col1','col2','col3','col4','col5'], 
        ['col1','col2','col3','col4','col5']
      ]

    var fields = exports.mergeDict(req.body, req.user);    

    console.log(fields["id"]);
    transactions_data(fields["id"]);

    render(res, {
      base: 'transfer',
      view: 'track',
      header: 'Transaction Overview',
      col1: 'Date',
      col2: 'Type',
      col3: 'With',
      col4: 'Status',
      col5: 'Gross',
      transactions: user_transactions,
      authenticated: true,
      title: 'Track',
    })
  } else {
    res.redirect('/liftoff/login');
  }
};

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
