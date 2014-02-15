
/*
 * HELPER FUNCTIONS
 */

function render(res, content) {
  var params = {
    //  Defaults
    title: 'Credism', 
    content: {
      page: 'index',
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
    page: 'index',
    authenticated: logged_in(req)
  });
};

exports.login = function(req, res){
  if (logged_in(req)) {
    render(res, {
      page: 'index',
      authenticated: true
    });
  } else {
    render(res, {
      page: 'login'
    });
  }
};

/*
 * TRANSFER
 */
exports.transfer = function(req, res){
  res.redirect('/');
};
exports.pay = function(req, res){
  res.redirect('/');
};
exports.withdraw = function(req, res){
  res.redirect('/');
};
exports.deposit = function(req, res){
  res.redirect('/');
};

/*
 * HISTORY
 */
exports.history = function(req, res){
  res.redirect('/');
};

exports.payments = function(req, res){
  res.redirect('/');
};

exports.withdrawals = function(req, res){
  res.redirect('/');
};

exports.deposits = function(req, res){
  res.redirect('/');
};
