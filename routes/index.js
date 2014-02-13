
/*
 * GET home page.
 */

exports.index = function(req, res){
  if (req.session['passport'] && req.session['passport'].user) {
    var balance = 1.000034234
    res.render('in', { title: 'Credism',  balance: balance});
  } else {
    res.render('out', { title: 'Credism' });
  }
};