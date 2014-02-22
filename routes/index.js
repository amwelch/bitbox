
/*
 * HELPER FUNCTIONS
 */

function render(res, content) {
  var params = {
    //  Defaults
    title: 'BitBox', 
    content: {
      base: 'index',
      view: false,
      alert: false,
      authenticated: false
    }
  };

  for (var key in content) {
    // important check that this is objects own property 
    // not from prototype prop inherited
    if(content.hasOwnProperty(key)) {
      params.content[key] = content[key];
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

/*
 * HOMEPAGE
 */
exports.index = function(req, res){
  render(res, {
    base: 'index',
    view: 'index',
    authenticated: logged_in(req)
  });
};

exports.login = function(req, res){
  if (logged_in(req)) {
    render(res, {
      base: 'index',
      view: 'index',
      authenticated: true
    });
  } else {
    render(res, {
      base: 'index',
      view: 'login'
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
      authenticated: true
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
      authenticated: true
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
      authenticated: true
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
      authenticated: true
    })
  } else {
    res.redirect('/liftoff/login');
  }
};

/*
 * HISTORY
 */
exports.history = function(req, res){
  if (logged_in(req)) {
    render(res, {

      base: 'history',
      view: 'index',
      authenticated: true
    })
  } else {
    res.redirect('/liftoff/login');
  }
};

exports.payments = function(req, res){
  if (logged_in(req)) {
    render(res, {

      base: 'history',
      view: 'payments',
      authenticated: true
    })
  } else {
    res.redirect('/liftoff/login');
  }
};

exports.withdrawals = function(req, res){
  if (logged_in(req)) {
    render(res, {

      base: 'history',
      view: 'withdrawals',
      authenticated: true
    })
  } else {
    res.redirect('/liftoff/login');
  }
};

exports.deposits = function(req, res){
  if (logged_in(req)) {
    render(res, {

      base: 'history',
      view: 'deposits',
      authenticated: true
    })
  } else {
    res.redirect('/liftoff/login');
  }
};

/* Account */
exports.userUpdate= function(req, res){
  if (logged_in(req)) {
      console.log("Got post");

      console.log(req.body.email);
      console.log(req.body.fname);
      console.log(req.body.lname);

      res.redirect('/accounts/user');
  } else {
    res.redirect('/liftoff/login');
  }
};
exports.identityUpdate= function(req, res){
  if (logged_in(req)) {
      console.log("Got post");
      res.redirect('/accounts/identity');
  } else {
    res.redirect('/liftoff/login');
  }
};
exports.securityUpdate= function(req, res){
  if (logged_in(req)) {
      console.log("Got post");
      res.redirect('/accounts/security');
  } else {
    res.redirect('/liftoff/login');
  }
};
exports.user= function(req, res){
  if (logged_in(req)) {
    render(res, {

      base: 'accounts',
      view: 'user',
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
      authenticated: true
    })
  } else {
    res.redirect('/liftoff/login');
  }
};
