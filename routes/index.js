
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

  REDIS.get("bitbox_btc_to_usd", function(err, conversion){
      if(err){
          console.log("ERROR IS err: " + err);
      }
      else{
       console.log("GOT CONVERSION: " + conversion);
       var params = {
         success: success,
         bitbox_btc_to_usd: conversion,
       };
       
       for (var key in content) {
         // important check that this is objects own property 
         // not from prototype prop inherited
         if(content.hasOwnProperty(key)) {
           params[key] = content[key];
         }
       }
       res.render('index', params);
     }
  });

};

function loggedIn(req) {
  var rValue = false;
  console.log(req.user);
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
        if (ENVIRONMENT != 'dev') {
          api.queryBlockChain(user.deposit_address, user.id);
        }
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
          address: user.deposit_address,
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

        var source;
        var destination;
        if (req.body.pay.op == "ask") {
          source = {
            facebook_id: req.body.pay.facebook_id,
            nickname: nickname
          };
          destination = {
            id: req.user.id
          };
        } else if (req.body.pay.op == "send") {
          source = {
            id: req.user.id
          };
          destination = {
            facebook_id: req.body.pay.facebook_id,
            nickname: nickname
          };
        } else {
          res.redirect('/transfer/pay?success=false');
          return;
        }

        api.transfer({
          source: source,
          destination: destination,
          type: "Payment",
          amount: req.body.pay.amount,
          memo: req.body.pay.memo
        }, 
        function(err, result) {
          if (err) {
            res.redirect('/transfer/pay?success=false');
          } else {
            //TODO ALLOW THE USER TO TURN OFF POSTING TO WALL
            //Need to submit app for review before we can tag peopl
            //var user_string = "@["+req.body.pay.facebook_id+":1:"+nickname+"]";
            var user_string = nickname;
            console.log("Using: " + user_string);
            var btc_total = Number((req.body.pay.amount*0.00000001).toFixed(4));
            redis_client.get("bitbox_btc_to_usd", function(err, conversion){
                if(err){
                    console.log("ERROR IS err: " + err);
                }
                else{
                    var usd = Number((parseFloat(conversion) * btc_total).toFixed(2));
                    message = "I just sent " + btc_total +" BTC ($"+usd+") to " + user_string + " via bitbox.\nMessage:\t" + req.body.pay.memo;
                    api.facebookPost(req.session.accessToken, message, req.user.id);
                    res.redirect('/transfer/pay?success=true');
                }
            });
          }
        });
      }
    });
  } else {
    res.redirect('/liftoff/login');
  }
};

/*Sample params grabbed from a request


  Response params
  {
  anonymous: 'false',
  shared: 'false',
  uid: '1',
  destination_address: '158tK8rpyWWrz4oX1fWeuWkXDV2v8pAgEK',
  confirmations: '0',
  address: '158tK8rpyWWrz4oX1fWeuWkXDV2v8pAgEK',
  value: '100000',
  input_address: '1LsTraiy6PAjbqT83MZFuUx96mN9HmfiS',
  secret: 'a3594b9cce57',
  input_transaction_hash: '287db46def7000a539832c6171f89bb5b905be5376f56fd65f3d5e4df5d29dd1',
  transaction_hash: 'a2d5519b72b1169ee73e00c144b6804c050eb1b43e0bf3f4de6fefb88e4b9af1' }

  http://blockchain.info/address/15Zi2ijqfPRM6Aqz68G6R5SHowFGXjao6X?format=json
*/


exports.blockChainIn = function(req, res) {
   params = req.query;
   console.log("Params");
   console.log(params);

   if (params.test){
       console.log("Test callback, ignoring");
   }

   var uid = params.uid;
   var secret = params.secret;
   /*Keep the hashes around for loggin*/
   var hashes = params.input_transaction_hash + " | " + params.transaction_hash;
   var bits = parseFloat(params.value);
   var addresses = params.input_address + " | " + params.destination_address;
   var confirms = parseInt(params.confirmations);

   var logMemo = "Deposit to Address: " + params.input_address;  
 
   /*Wait until we see n confirms before acking the deposit*/
   /*blockchain will continue sending notifications on each block until the server returns status code 200 */
   var reqConfirms = 6;
   console.log("GETTING USER WITH ID " + uid);
   api.getUser({id:uid}, function(err, user) {
      console.log("Got user ");
      console.log(user);
      /* Check user secret to verify its coming from blockchain */
      /*Deposit the amount */
 
      if (user.secret != params.secret){
          console.log("MISMATCHED SECRET THIS SHOULD NEVER HAPPEN");
          res.writeHead(200, {'Content-Type': 'text/plain'});
          res.write('*ok*');
          res.end();
          return;
      }

      api.createOrUpdateDeposit({
        source: {id: -1},   
        destination: {id: uid},
        type: "Deposit",
        amount: bits,
        memo: logMemo,
        confirmations: confirms,
        depositId: params.input_transaction_hash,
      }, function(err, result) {
         if (err){
            console.log("ERROR WITH DEPOSIT CALLBACK");
            console.log(err);
            console.log(logMemo);
         }
         else{
            console.log("SUCCESS WITH DEPOSIT CALLBACK");
            console.log(logMemo);
         }
      });
      if( parseInt(confirms) < reqConfirms ){
         console.log("NOT ENOUGH CONFIRMS");
         res.writeHead(200, {'Content-Type': 'text/plain'});
         res.end();
         return;
      }
      api.completeDeposit({depositId: params.transaction_hash}, function(err, result){
          if (err){
              console.log("ERROR COMPLETING");
          }
          else{
              console.log("Finished COMPLETING");
          }
      });
      console.log("COMPLETING TRANSACTION");
      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.write('*ok*');
      res.end();
   });
}

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

  //Add in miner tax
  console.log("Before Tax " + req.body.withdraw.amount);
  var amount = parseInt(req.body.withdraw.amount) + 50000;

  console.log("Withdrawing " + amount);

  if (loggedIn(req)) {
    api.transfer({
      source: { id: req.user.id },
      destination: { id: -1 },
      type: "Withdrawal",
      amount: amount,
      address: req.body.withdraw.address,
      memo: "Withdrawing to: " + req.body.withdraw.address
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


exports.fb_test = function(req, res){
    console.log("Test is go");
    console.log("Token: " + req.session.accessToken);
    api.facebookPost(req.session.accessToken);
    res.redirect('/');
}
exports.userInfo = function(req, res){
  if (loggedIn(req)) {
      res.json(req.user);
  } else {
    res.redirect('/liftoff/login');
  }
};

exports.user = function(req, res){
  if (loggedIn(req)) {
    api.getUser(req.user, function(err, user) {
      render(req, res, {
        base: 'accounts',
        view: 'user',
        title: 'My Account',
        name: user.nickname,
        authenticated: true
      });
    });
  } else {
    res.redirect('/liftoff/login');
  }
};

exports.identity= function(req, res){
  if (loggedIn(req)) {
    api.getUser(req.user, function(err, user) {
      render(req, res, {
        base: 'accounts',
        view: 'identity',
        title: 'Identity',
        name: user.nickname,
        authenticated: true
      });
    });
  } else {
    res.redirect('/liftoff/login');
  }
};

exports.betaEmail = function(req, res){
  var UNAME = "";
  var PW = "";
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
    api.getUser(req.user, function(err, user) {
      render(req, res, {
        base: 'accounts',
        view: '2FA',
        title: '2FA',
        name: user.nickname,
        authenticated: true
      });
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
/*{ displayname: 'Test123', pay: { op: 'true' } }*/
exports.controlUser = function(req, res){
  if (loggedIn(req)){
      api.getUser(req.user, function(err, user){
          var name = req.body.displayname;
          if (!name){
              name = user.nickname;
          }
          var data={
            id: req.user.id,
            facebookPost: req.body.post.op,
            nickname: name
          }
          api.updateUser(data, function(err){
              if (err){
                  res.redirect('/accounts/user?success=false');
              }
              else{
                  res.redirect('/accounts/user?success=true');
              }
          });
      });
  } else {
    res.redirect('/liftoff/login');
  }
};
