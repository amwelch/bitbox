
var http = require('http');
var api = require('./api');
var ec = require('./error-codes');
exports.api = api;


//HELPER FUNCTIONS


function render(req, res, content) {
  var success;
  if (req.query.success == "true"){
    success = true;
  } else if (req.query.success == "false"){
    success = false;
  } else {
    success = null;
  }

  var params = {
    success: success
  };

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

function getFacebookName(facebook_id, callback) {
  http.get("http://graph.facebook.com/"+facebook_id, function(res) {
    var body = '';

    res.on('data', function(chunk) {
      body += chunk;
    });

    res.on('end', function() {
      var fbResponse = JSON.parse(body);
      callback(null, fbResponse.name);
    });
  }).on('error', function(e) {
      callback("Unable to connect", null);
  });
}

function prepareTransfer(data, callback) {

  //  TODO: Sanitize inputs here

  //  GET SOURCE ACCT
  api.getUser(data.source, function(err, source) {
    if (err) {
      callback(err, null);
    } else {

      //  GET DEST ACCT
      api.getOrCreateUser(data.destination, function(err, destination) {
        if (err) {
          callback(err, null);
        } else {
          data.source = source;
          data.destination = destination;
          callback(null, data);
        }
      });
    }
  });
};

//HOMEPAGE

exports.index = function(req, res){
  //TODO: Whats the default page for logged in?
  if (loggedIn(req)) {
    res.redirect('/transfer/pay');
  } else {
    render(req, res, {
      base: 'index',
      view: 'index',
      authenticated: false,
      title: 'Social Bitcoin'
    });
  }
};

exports.login = function(req, res) {
  if (loggedIn(req)) {
    render(req, res, {
      base: 'index',
      view: 'index',
      authenticated: true,
      title: 'Social Bitcoin'
    });
  } else {
    render(req, res, {
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

exports.transfer = function(req, res) {
  if (loggedIn(req)) {
    res.redirect('/transfer/pay');
  } else {
    res.redirect('/liftoff/login');
  }
}

exports.viewPay = function(req, res) {  
  if (loggedIn(req)) {
    api.getUser(req.user, function(err, user) {
      if (err) {
        console.log("Unable to get user");
        res.redirect("/");
      } else {
        render(req, res, {
          base: 'transfer',
          view: 'pay',
          authenticated: true,
          title: 'Payment',
          balance: user.balance,
          name: user.nickname
        });
      }
    });
  } else {
    res.redirect('/liftoff/login');
  }
};

exports.viewTrack = function(req, res) {
  if (loggedIn(req)) {
    api.getUser(req.user, function(err, user) {
      if (err) {
        console.log("Unable to get user");
        res.redirect("/");
      } else {
        api.track(user.id, function(err, history) {
          if (err) {
            console.log("Unable to get user");
            res.redirect("/");
          } else {
            render(req, res, {
              base: 'transfer',
              view: 'track',
              authenticated: true,
              title: 'Track',
              balance: user.balance,
              name: user.nickname,
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
    api.getUser(req.user, function(err, user) {
      if (err) {
        console.log("Unable to get user");
        res.redirect("/");
      } else {
        render(req, res, {
          base: 'transfer',
          view: 'deposit',
          authenticated: true,
          title: 'Deposit',
          balance: user.balance,
          name: user.nickname
        });
      }
    });
  } else {
    res.redirect('/liftoff/login');
  }
};

exports.viewWithdraw = function(req, res) {
  if (loggedIn(req)) {
    api.getUser(req.user, function(err, user) {
      if (err) {
        console.log("Unable to get user");
        res.redirect("/");
      } else {
        render(req, res, {
          base: 'transfer',
          view: 'withdraw',
          authenticated: true,
          title: 'Withdraw',
          balance: user.balance,
          name: user.nickname
        });
      }
    });
  } else {
    res.redirect('/liftoff/login');
  }
};

exports.controlPay = function(req, res) {
  if (loggedIn(req)) {
    getFacebookName(req.body.pay.facebook_id, function(err, nickname) {
      if (err) {
        res.redirect('/transfer/pay?success=false');
      } else {
        api.transfer({
          source: { id: req.user.id },
          destination: {
            facebook_id: req.body.pay.facebook_id,
            nickname: nickname
          },
          type: "Payment",
          amount: req.body.pay.amount,
          memo: req.body.pay.memo
        }, 
        function(err, result) {
          if (err) {
            res.redirect('/transfer/pay?success=false');
          } else {
            res.redirect('/transfer/pay?success=true');
          }
        });
      }
    });
  } else {
    res.redirect('/liftoff/login');
  }
};

exports.controlDeposit = function(req, res) {
  if (loggedIn(req)) {
    api.transfer({
      source: { id: -1 },
      destination: { id: req.user.id },
      type: "Deposit",
      amount: req.body.deposit.amount,
      memo: "TODO: Actual BTC deposits"
    }, 
    function(err, result) {
      if (err) {
        res.redirect('/transfer/deposit?success=false');
      } else {
        res.redirect('/transfer/deposit?success=true');
      }
    });
  } else {
    res.redirect('/liftoff/login');
  }
};

exports.controlWithdraw = function(req, res) {
  if (loggedIn(req)) {

    api.transfer({
      source: { id: req.user.id },
      destination: { id: -1 },
      type: "Withdrawal",
      amount: req.body.withdraw.amount,
      memo: req.body.withdraw.address
    }, function(err, data) {
      if (err) {
        res.redirect('/transfer/withdraw?success=false');
      } else {
        res.redirect('/transfer/withdraw?success=true');
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
    render(req, res, {
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
    render(req, res, {

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
  render(req, res, {
    base: 'beta',
    view: 'signup',
    title: 'Sorry!',
    authenticated: false
  });
};

exports.security= function(req, res){
  if (loggedIn(req)) {
    render(req, res, {

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
  render(req, res, {
    base: 'index',
    view: 'lobby',
    authenticated: false,
    title: 'Lobby'
  });
}
