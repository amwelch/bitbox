/*Temporary ips*/
var ip = '172.31.9.227';
var eip = '54.200.103.29';

var args = process.argv.slice(2);
var dev = false;
if (args.indexOf('dev') != -1){
    dev = true;
}
/**
 * Module dependencies.
 */

var express = require('express');

//  Authentication
var passport = require('passport');
var FacebookStrategy = require('passport-facebook').Strategy;

/* Redis only on production */
if (!dev){
    RedisStore = require("connect-redis")(express);
    redis = require("redis").createClient();
}
// Used for transactions
var pg = require('pg');
var app = express();
var https = require('https');
var fs = require('fs');


//If not dev redirect to https for all requests
function requireHTTPS(req, res, next) {
    if (!req.secure){
        return res.redirect('https://' + req.get('host') + req.url);
    }
    next();
}
//  Rendering
var routes = require('./routes');

var ec = require('./routes/error-codes');

//  ------- Server Configuration -------
var app = express();  
app.configure(function() {
  app.use(express.favicon());
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(express.static('public'));
  app.use(express.cookieParser());
  //app.use(express.bodyParser()); // Replaced by following 2 lines:
  app.use(express.json());       // to support JSON-encoded bodies
  app.use(express.urlencoded()); // to support URL-encoded bodies
  if (!dev){
    app.use(express.session({ 
      secret: 'lsfkahfasho124h18087fahg0db0123g12r',
      store: new RedisStore({client:redis})
    }));
  }
  else{
    app.use(express.session({ 
      secret: 'lsfkahfasho124h18087fahg0db0123g12r'
    }));
  }
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(app.router);
});

//  ------- Authentication Configuration -------
passport.serializeUser(function(user, done) {
  done(null, JSON.stringify({
    id: user.id,
    facebook_id: user.facebook_id,
  }));
});

passport.deserializeUser(function(serialized_user, done) {
  done(null, JSON.parse(serialized_user));
});

var strat;
if (dev){
  strat = {
    clientID: process.env.FACEBOOK_APP_ID || '609051335829720',
    clientSecret: process.env.FACEBOOK_SECRET || '34320f120be92b774111a4f1d6d34743',
    callbackURL: 'http://localhost:3000/liftoff/login/facebook/callback',
  };
}
else{
  strat = {
    clientID: process.env.FACEBOOK_APP_ID || '761870430491153',
    clientSecret: process.env.FACEBOOK_SECRET || '9295cdcd4e95c520e5602fe9de90ce8c',
    callbackURL: 'http://'+eip+':443/liftoff/login/facebook/callback',
  };
}
passport.use( 
  new FacebookStrategy(strat,
  function(accessToken, refreshToken, profile, done) {
    var data = {
      email: profile.emails[0].value,
      firstname: profile.name.givenName,
      lastname: profile.name.familyName,
      nickname: profile.name.givenName + " " + profile.name.familyName,
      facebook_id: profile.id.toString()
    };
    routes.api.getOrCreateUser(data, function(err, user) {
      if (err) {
        console.log(err);
      } else {
        if (user.status == 'Active') {
          done(null, user);
        } else if (user.status == 'Inactive') {
          routes.api.activateUser(user, function(err, user) {
            if (err) {
              done(null, null);
            } else {
              done(null, user);
            }
          });
        } else {
          done(null, user);
        }
      }
    });
  })
);

//  ------- Rendering Configuration -------
var postLater = function(req, res) {
  console.log("Endpoint not implemented: "+req.url);
  res.redirect(req.url);
};

//  Facebook Login. Loops back to ./callback
app.get('/liftoff/login/facebook',
  passport.authenticate('facebook', { 
    scope: 'email',
    display: 'popup',
    authType: 'reauthenticate'
  })
);

//  Loopback from FB login. Attempts to get Access Token.
app.get('/liftoff/login/facebook/callback', 
  passport.authenticate('facebook', {
    successRedirect: '/',
    failureRedirect: '/lobby' 
  })
);

app.get('/api/userInfo', routes.userInfo);

app.get('/logout', routes.logout);

app.get('/transfer/pay', routes.viewPay);
app.get('/transfer/track', routes.viewTrack);
app.get('/transfer/deposit', routes.viewDeposit);
app.get('/transfer/withdraw', routes.viewWithdraw);

app.post('/transfer/pay', routes.controlPay);
app.post('/transfer/track', postLater);
app.post('/transfer/deposit', routes.controlDeposit);
app.post('/transfer/withdraw', routes.controlWithdraw);

app.get('/transfer', routes.transfer);

app.get('/accounts/user', routes.user);
app.post('/accounts/user', postLater);

app.get('/accounts/security', routes.security);
app.post('/accounts/security', postLater);

app.get('/beta', routes.betaSignUp);
app.post('/beta', routes.betaEmail);

app.get('/api/userInfo', routes.userInfo);
app.get('/accounts/identity', routes.identity);
app.post('/accounts/identity', postLater);


app.get('/lobby', routes.lobby);
app.get('/liftoff/login', routes.index);
app.get('/liftoff', routes.index);
app.get('/', routes.index);

if (dev){
  var port = process.env.PORT || 3000;
  app.listen(port, function() {
    console.log('Listening on ' + port)
  });
}
else{
  /*app.use(requireHTTPS);
  var options = {
      key: fs.readFileSync('/keykeeper.pem'),
      cert: fs.readFileSync('/bbcsr.pem'),
  }*/
  var port = process.env.PORT || 443;
  //https.createServer(options, app).listen(port, ip, function() {
  app.listen(port, ip, function() {
    console.log('Listening on ' + port);
  });
}
