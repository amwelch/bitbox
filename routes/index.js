
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
