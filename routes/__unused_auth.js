
//	TODO: DELETE?
var url = require('url');
var FBAPP = {
  id: process.env.FACEBOOK_APP_ID || '609051335829720',
  secret: process.env.FACEBOOK_SECRET || '34320f120be92b774111a4f1d6d34743',
  ns: process.env.FACEBOOK_NAMESPACE || 'credism',
  scope: process.env.FACEBOOK_SCOPE || 'email'
};

exports.list = function(req, res){
  res.send("Logged into app: " + FBAPP.id);
};
