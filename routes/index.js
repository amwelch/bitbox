
var api = require('./api');
var ec = require('./error-codes');
exports.api = api;


//HELPER FUNCTIONS


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

function loggedIn(req) {
  var rValue = false;
  if (req.user) {
    rValue = true;
  }
  return rValue;
}

function userId(req) {
  return req.user.id;
}

function facebookId(req) {
  return req.user.facebook_id;
}


//HOMEPAGE

exports.index = function(req, res){
  //TODO: Whats the default page for logged in?
  if (logged_in(req)) {
    res.redirect('/transfer/pay');
  }
  else{
    render(res, {
      base: 'index',
      view: 'index',
      authenticated: logged_in(req),
      title: 'Social Bitcoin'
    });
  }
};
exports.index = function(req, res) {
  render(res, {
    base: 'index',
    view: 'index',
    authenticated: loggedIn(req),
    title: 'Social Bitcoin'
  });
};
exports.login = function(req, res) {
  if (loggedIn(req)) {
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

exports.logout = function(req, res) {
  req.logout();
  res.redirect('/');
};

//TRANSFER


exports.transfer = function(req, res) {
  if (loggedIn(req)) {
    res.redirect('/transfer/pay');
  } else {
    res.redirect('/liftoff/login');
  }
}

exports.viewPay = function(req, res) {  
  if (loggedIn(req)) {
    api.getUserByUserId(userId(req), function(err, user) {
      if (err) {
        console.log("Unable to get user");
        res.redirect("/");
      } else {
        var success;
        if (req.query.success == "true"){
            success= "true";
        }
        else if (req.query.success == "false"){
            success = "false";
        }
        else {
            success = "null";
        }
        render(res, {
          success: success,
          base: 'transfer',
          view: 'pay',
          authenticated: true,
          title: 'Payment',
          balance: user.balance
        });
      }
    });
  } else {
    res.redirect('/liftoff/login');
  }
};

exports.viewTrack = function(req, res) {
  if (loggedIn(req)) {
    api.getUserByUserId(userId(req), function(err, user) {
      if (err) {
        console.log("Unable to get user");
        res.redirect("/");
      } else {
        api.track(user.id, function(err, history) {
          if (err) {
            console.log("Unable to get user");
            res.redirect("/");
          } else {
            render(res, {
              base: 'transfer',
              view: 'track',
              authenticated: true,
              title: 'Track',
              balance: user.balance,
              history: history
            });
          }
        });
      }
    });
  } else {
    res.redirect('/liftoff/login');
  }
};

exports.viewDeposit = function(req, res) {
  if (loggedIn(req)) {
    api.getUserByUserId(userId(req), function(err, user) {
      if (err) {
        console.log("Unable to get user");
        res.redirect("/");
      } else {
        render(res, {
          base: 'transfer',
          view: 'deposit',
          authenticated: true,
          title: 'Deposit',
          balance: user.balance
        });
      }
    });
  } else {
    res.redirect('/liftoff/login');
  }
};

exports.viewWithdraw = function(req, res) {
  if (loggedIn(req)) {
    api.getUserByUserId(userId(req), function(err, user) {
      if (err) {
        console.log("Unable to get user");
        res.redirect("/");
      } else {
        render(res, {
          base: 'transfer',
          view: 'withdraw',
          authenticated: true,
          title: 'Withdraw',
          balance: user.balance
        });
      }
    });
  } else {
    res.redirect('/liftoff/login');
  }
};

exports.controlPay = function(req, res) {
  if (loggedIn(req)) {
    //  TODO: SANITIZE!
    var form = {
      source_id: userId(req),
      destination_fbid: req.body.facebook_id,
      amount: req.body.amount,
      memo: req.body.memo
    };

    api.pay(form, function(error, result) {
      if (error != null) {
        res.redirect('/transfer/pay?success=false');
      } else {
        res.redirect('/transfer/pay?success=true');
      }
    });
  } else {
    res.redirect('/liftoff/login');
  }
};

exports.controlDeposit = function(req, res) {
  if (loggedIn(req)) {
    //  TODO: SANITIZE!
    var form = {
      destination_fbid: facebookId(req),
      amount: req.body.amount
    };

    api.deposit(form, function(code, result) {
      if (code != ec.SUCCESS) {
        res.redirect('/transfer/pay?success=false');
      } else {
        res.redirect('/transfer/pay?success=true');
      }
    });
  } else {
    res.redirect('/liftoff/login');
  }
};

exports.controlWithdraw = function(req, res) {
  if (loggedIn(req)) {
    //  TODO: SANITIZE!
    var form = {
      source_id: userId(req),
      address: req.body.address,
      amount: req.body.amount,
    };

    api.withdraw(form, function(code, result) {
      if (code != ec.SUCCESS) {
        res.redirect('/transfer/pay?success=false');
      } else {
        res.redirect('/transfer/pay?success=true');
      }
    });
  } else {
    res.redirect('/liftoff/login');
  }
};

exports.userInfo = function(req, res){
  if (loggedIn(req)) {
      res.json(req.user);
  } else {
    res.redirect('/liftoff/login');
  }
};

exports.user = function(req, res){
  if (loggedIn(req)) {
    render(res, {

      //TODO for now fetch data for user from db here but in the future we want to fetch this on login and pass it around

      base: 'accounts',
      view: 'user',
      title: 'My Account',
      authenticated: true
    });
  } else {
    res.redirect('/liftoff/login');
  }
};

exports.identity= function(req, res){
  if (loggedIn(req)) {
    render(res, {

      base: 'accounts',
      view: 'identity',
      title: 'Identity',
      authenticated: true
    });
  } else {
    res.redirect('/liftoff/login');
  }
};
exports.betaEmail = function(req, res){
  var UNAME = "";
  var PW = "";
  console.log("Made it here");
  console.log(req.body.email);
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
  });
};
exports.security= function(req, res){
  if (loggedIn(req)) {
    render(res, {

      base: 'accounts',
      view: '2FA',
      title: '2FA',
      authenticated: true
    });
  } else {
    res.redirect('/liftoff/login');
  }
};

exports.lobby = function(req, res) {
  render(res, {
    base: 'index',
    view: 'lobby',
    authenticated: false,
    title: 'Lobby'
  });
}
