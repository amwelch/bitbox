
var http = require('http');
var https = require('https');
var api = require('../api/');
var sio = require('./socket');
var uuid = require('node-uuid');
var cfg = require('./cfg.js');

function require_login(res) {
  res.redirect('/liftoff/login');
}


function render(req, res, content) {
  var success;
  if (req.query.success == "true") {
    success = true;
  } else if (req.query.success == "false") {
    success = false;
  } else {
    success = null;
  }

  REDIS.get("bitbox_btc_to_usd", function(err, conversion){
    REDIS.get("bitbox_usd_to_other", function(err, conversion_other){
      if (err) {
        console.log("ERROR IS err: " + err);
      } else {
        console.log("GOT CONVERSION: " + conversion);
        console.log("GOT CONVERSION OTHER: " + conversion_other);
        conversion_other = JSON.parse(conversion_other);
        var params = {
          success: success,
          bitbox_btc_to_usd: conversion,
          bitbox_usd_to_ca : conversion_other["bitbox_usd_to_ca"],
          bitbox_usd_to_eu :conversion_other["bitbox_usd_to_eu"],
          bitbox_usd_to_uk :conversion_other["bitbox_usd_to_uk"],
          bitbox_usd_to_au :conversion_other["bitbox_usd_to_au"],
          bitbox_usd_to_mx :conversion_other["bitbox_usd_to_mx"],
          bitbox_usd_to_br :conversion_other["bitbox_usd_to_br"],
          bitbox_usd_to_ar :conversion_other["bitbox_usd_to_ar"],
          bitbox_usd_to_jp :conversion_other["bitbox_usd_to_jp"],
          bitbox_usd_to_ch :conversion_other["bitbox_usd_to_ch"],
          fb_app_id: FB_APP_ID,
          user_id: req.user.id
        };
       
        for (var key in content) {
          if(content.hasOwnProperty(key)) {
            params[key] = content[key];
          }
        }
        res.render('index', params);
      }
    });
  });
};

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

exports.index = function(req, res){
  //TODO: Whats the default page for logged in?
  if (req.user.valid) {
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
  render(req, res, {
    base: 'index',
    view: 'login',
    authenticated: req.user.valid,
    title: 'Social Bitcoin'
  });
};

exports.logout = function(req, res) {
  req.logout();
  res.redirect('/');
};

exports.transfer = function(req, res) {
  if (req.user.valid) {
    res.redirect('/transfer/pay');
  } else {
    require_login(res);
  }
}

exports.viewPay = function(req, res) {  
  if (req.user.valid) {
    render(req, res, {
      base: 'transfer',
      view: 'pay',
      authenticated: true,
      title: 'Payment',
      balance: req.user.balance,
      name: req.user.nickname
    });
  } else {
    require_login(res);
  }
};


exports.controlTransferSingle = function(req, res) {
  console.log(req.params.id);
  res.redirect('/transfer/track');
};

exports.viewTransferSingle = function(req, res) {
  var transaction_uuid = req.params.id;
  console.log("HERE");
  if (req.user.valid) {
    api.getTransactionByUuid({
      user_id: req.user.id, 
      transaction_uuid: transaction_uuid
    }, function(err, transaction) {
      if (err) {
        console.log("Unable find txn");
        res.redirect("/");
      } else {        
        render(req, res, {
          base: 'transfer',
          view: 'track',
          action: 'single',
          authenticated: true,
          title: 'View Transaction',
          balance: req.user.balance,
          name: req.user.nickname,
          transaction: transaction,
          is_source: (req.user.id == transaction.source_id)
        });
      }
    });
  } else {
    require_login(res);
  }
};

exports.viewTransferList = function(req, res) {
  if (req.user.valid) {
    if (ENVIRONMENT != 'dev') {
      api.queryBlockChain(req.user.deposit_address, req.user.id);
    }
    
    api.getTransactionsByUserId(req.user.id, function(err, history) {
      if (err) {
        res.redirect("/");
      } else {
        console.log(history);
        render(req, res, {
          base: 'transfer',
          view: 'track',
          action: 'list',
          authenticated: true,
          title: 'Track',
          balance: req.user.balance,
          name: req.user.nickname,
          history: history
        });
      }
    });
  } else {
    require_login(res);
  }
};

exports.viewNotificationsList = function(req, res) {
  console.log("||||||||||||||||||GETTING Notifications");
  if (req.user.valid) {
    api.getNotifications({id: req.user.id}, function(err, result) {
      if (err) {
        console.log("||||||||||||||||||EROOR");
        console.log(err);
        res.redirect("/");
      } else {
        console.log("||||||||||||||||||Notifications");
        console.log(result.rows);
        render(req, res, {
          base: 'transfer',
          view: 'notifications',
          authenticated: true,
          title: 'Notifications',
          balance: req.user.balance,
          name: req.user.nickname,
          history: result.rows
        });
      }
    });
  } else {
    require_login(res);
  }
};

exports.viewDeposit = function(req, res) {
  if (req.user.valid) {
    render(req, res, {
      base: 'transfer',
      view: 'deposit',
      authenticated: true,
      title: 'Deposit',
      balance: req.user.balance,
      address: req.user.deposit_address,
      name: req.user.nickname
    });
  } else {
    require_login(res);
  }
};

exports.viewWithdraw = function(req, res) {
  if (req.user.valid) {
    render(req, res, {
      base: 'transfer',
      view: 'withdraw',
      authenticated: true,
      title: 'Withdraw',
      balance: req.user.balance,
      name: req.user.nickname
    });
  } else {
    require_login(res);
  }
};

exports.controlPay = function(req, res) {
  if (req.user.valid) {

    //  TODO: Error check these
    var source;
    var destination;
    var status;
    var type;

    if (req.body.pay.op == "ask") {
      
      source = { facebook_id: req.body.pay.facebook_id };
      destination = { id: req.user.id };
      
      status = 'Requested';
      type = 'asked';

    } else if (req.body.pay.op == "send") {
      
      source = { id: req.user.id };
      destination = { facebook_id: req.body.pay.facebook_id };

      status = 'Pending';
      type = 'sent';

    } else {
      res.redirect('/transfer/pay?success=false');
      return;
    }

    getFacebookName(req.body.pay.facebook_id, function(err, nickname) {
      if (req.body.pay.op == "ask") {
        source.nickname = nickname;
      } else if (req.body.pay.op == "send") {
        destination.nickname = nickname;
      }
      console.log(source);

      var unique_id = uuid.v4();
      if (err) {
        res.redirect('/transfer/pay?success=false');
      } else {
        api.transfer({
          source: source,
          destination: destination,
          status: status,
          type: "Payment",
          amount: req.body.pay.amount,
          memo: req.body.pay.memo,
          tx_uuid: unique_id
        }, 
        function(err, result) {
          if (err) {
            res.redirect('/transfer/pay?success=false');
          } else {
            var user_string = nickname;
            console.log("Using: " + user_string);
            var btc_total = Number((req.body.pay.amount*0.00000001).toFixed(4));
            REDIS.get("bitbox_btc_to_usd", function(err, conversion){
                if(err){
                    console.log("ERROR IS err: " + err);
                }
                else{
                    var usd = Number((parseFloat(conversion) * btc_total).toFixed(2));
                    var btc = Number(btc_total).toFixed(8);
                    var verb = type;
                    if (verb == "asked"){
                      verb = "requested"
                    }
                    message = "I just " + verb + " " + btc +" BTC ($"+usd+") to " + user_string + " via bitbox."
                    var tail = "\nMessage:\t" + req.body.pay.memo;

                    if (req.body.pay.memo != ""){
                      message = message + tail;
                    }

                    api.facebookPost(req.session.accessToken, message, req.user.id);

                    // Send notification using sockets
                    notification_msg = " just " + type + " you " + req.body.pay.amount +" satoshi ($"+usd+").";
                    sio.sendNotification({
                      dst_fb_id: req.body.pay.facebook_id, 
                      src_id: req.user.id,
                      type: req.body.pay.op, 
                      tx_uuid: unique_id
                    }, notification_msg);                    

                    res.redirect('/transfer/track/'+unique_id+'?success=true');
                }
            });
          }
        });
      }
    });
  } else {
    require_login(res);
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
   console.log("Params from blockchain in");
   console.log(params);

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
 
      if (user.secret != params.secret || params.test){
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
            if( parseInt(confirms) < reqConfirms ){
               console.log("NOT ENOUGH CONFIRMS");
               res.writeHead(200, {'Content-Type': 'text/plain'});
               res.end();
               return;
            }
            api.completeDeposit({depositId: params.input_transaction_hash}, function(err, result){
                if (err){
                    console.log("ERROR COMPLETING");
                }
                else{
                    console.log("Finished COMPLETING");
                    console.log("COMPLETING TRANSACTION");
                    res.writeHead(200, {'Content-Type': 'text/plain'});
                    res.write('*ok*');
                    res.end();
                }
            });
         }
      });
   });
}

exports.controlDeposit = function(req, res) {
  if (req.user.valid) {
    api.transfer({
      source: { id: -1 },
      destination: { id: req.user.id },
      status: 'Pending',
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
    require_login(res);
  }
};

exports.controlWithdraw = function(req, res) {

  //Add in miner tax
  console.log("Before Tax " + req.body.withdraw.amount);
  var amount = parseInt(req.body.withdraw.amount) + 1000;

  console.log("Withdrawing " + amount);

  if (req.user.valid) {
    api.transfer({
      source: { id: req.user.id },
      destination: { id: -1 },
      status: 'Pending',
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
    require_login(res);
  }
};


exports.fb_test = function(req, res){
  console.log("Test is go");
  console.log("Token: " + req.session.accessToken);
  api.facebookPost(req.session.accessToken);
  res.redirect('/');
}
exports.userInfo = function(req, res){
  if (req.user.valid) {
    // TODO scope this object
    res.json(req.user);
  } else {
    require_login(res);
  }
};

exports.user = function(req, res){
  if (req.user.valid) {
    render(req, res, {
      base: 'accounts',
      view: 'user',
      title: 'My Account',
      name: req.user.nickname,
      facebookPost: req.user.facebookPost,
      authenticated: true
    });
  } else {
    require_login(res);
  }
};

exports.identity= function(req, res){
  if (req.user.valid) {
    render(req, res, {
      base: 'accounts',
      view: 'identity',
      title: 'Identity',
      name: req.user.nickname,
      authenticated: true
    });
  } else {
    require_login(res);
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
  if (req.user.valid) {
    render(req, res, {
      base: 'accounts',
      view: '2FA',
      title: '2FA',
      name: req.user.nickname,
      authenticated: true
    });
  } else {
    require_login(res);
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
  console.log(req.user);
  if (req.user.valid) {
    var name = req.body.displayname;
    if (!name){
      name = req.user.nickname;
    }

    var data = {
      id: req.user.id,
      facebookPost: req.body.post.op,
      nickname: name
    }
    api.updateUser(data, function(err){
      if (err){
         res.redirect('/accounts/user?success=false');
      } else {
        console.log("THIS GUY");
        console.log(req.user.facebookPost);
        if (req.body.post.op == 'true' && req.user.facebookPost == false){
            res.redirect('/liftoff/login/facebook?post=true');
        }
        else{
            res.redirect('/accounts/user?success=true');
        }
      }
    });
  } else {
    require_login(res);
  }
};

exports.transactionCancel = function(req, res) {
  var transaction_uuid = req.params.id;
  api.cancelTransaction({
    user_id: req.user.id,
    transaction_uuid: transaction_uuid
  },
  function(err, user) {
    if (err) {
      console.log(err);
      res.redirect('/transfer/track/'+transaction_uuid+'?success=false');
    } else {
      res.redirect('/transfer/track/'+transaction_uuid+'?success=true');
    }
  });
}

exports.transactionApprove = function(req, res) {
  var transaction_uuid = req.params.id;
  api.approveTransaction({
    user_id: req.user.id,
    transaction_uuid: transaction_uuid
  },
  function(err, user) {
    if (err) {
      res.redirect('/transfer/track/'+transaction_uuid+'?success=false');
    } else {
      res.redirect('/transfer/track/'+transaction_uuid+'?success=true');
    }
  });
}

exports.transactionDecline = function(req, res) {
  var transaction_uuid = req.params.id;
  api.declineTransaction({
    user_id: req.user.id,
    transaction_uuid: transaction_uuid
  },
  function(err, user) {
    if (err) {
      console.log(err);
      res.redirect('/transfer/track/'+transaction_uuid+'?success=false');
    } else {
      res.redirect('/transfer/track/'+transaction_uuid+'?success=true');
    }
  });
}

exports.transactionRefund = function(req, res) {
  var transaction_uuid = req.params.id;
  api.refundTransaction({
    user_id: req.user.id,
    transaction_uuid: transaction_uuid
  },
  function(err, user) {
    if (err) {
      res.redirect('/transfer/track/'+transaction_uuid+'?success=false');
    } else {
      res.redirect('/transfer/track/'+transaction_uuid+'?success=true');
    }
  });
}

exports.validateAddress = function(req, res){
    console.log(req.query);
    var addr = req.query.addr;
    var options = {
        host: 'blockchain.info',
        port: '443',
        path: '/q/addressbalance/'+addr
    }
    console.log(options);
    https.get(options, function(resp){
        resp.on('data', function(chunk){
          console.log("Got data " + chunk);
          if (!isNaN(parseInt(chunk))){
              res.writeHead(200, {'Content-Type': 'text/plain'});
              res.write('ok');
              res.end();
          }
          else{
              res.writeHead(200, {'Content-Type': 'text/plain'});
              res.write('no');
              res.end();
          }
        });
    }).on("error", function(e){
        console.log("Got error: " + e.message);
        res.writeHead(200, {'Content-Type': 'text/plain'});
        res.write('no');
        res.end();
    });
}
exports.redeem = function(req, res){
  if (req.user.valid) {
    render(req, res, {
      base: 'transfer',
      view: 'redeem',
      title: 'redeem',
      name: req.user.nickname,
      balance: req.user.balance,
      authenticated: true
    });
  }
  else{
    require_login(res);
  }
}
exports.controlRedeem = function(req, res){
  if (req.user.valid){
    console.log(req.user);
    if (req.user.redeemedCode == false){
      if (req.body.redeem == cfg.code){
        data = {
          id: req.user.id,
          balance: req.user.balance
        };
        api.redeem(data, function(err, result){
            if(err){
              console.log("Could not update");
              console.log(err);
              res.redirect('/transfer/redeem?success=false');
              return;
            }
            else{
              res.redirect('transfer/redeem?success=true');
              return;
            }
        });
        return;
      }
      else{
        console.log("Incorrect Code");  
      }
    }
    console.log("Already redeemed");
    console.log("user code " + req.user.redeemedCode);
    res.redirect('/transfer/redeem?success=false');
    return;
  }
  else{
    require_login(res);
  }
}

