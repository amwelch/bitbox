
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
exports.track = function(req, res){
  if (logged_in(req)) {
    render(res, {

      base: 'transfer',
      view: 'track',
      authenticated: true,
      title: 'Track'
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
