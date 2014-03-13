//  ------- Module Dependencies -------
//  Server
var express = require('express');

//  Authentication
var passport = require('passport');
var FacebookStrategy = require('passport-facebook').Strategy;

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
  app.use(express.session({ secret: 'CHANGE ME nonce9001' }));
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

passport.use( 
  new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID || '609051335829720',
    clientSecret: process.env.FACEBOOK_SECRET || '34320f120be92b774111a4f1d6d34743',
    callbackURL: 'http://localhost:3000/liftoff/login/facebook/callback',
  },
  function(accessToken, refreshToken, profile, done) {
    //  First try finding a user
    console.log(profile);
    routes.api.getOrCreateUserByFB(profile, function(err, result) {
      if (err) {
        console.log(err);
      } else {
        done(null, result);
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
    successRedirect: '/transfer',
    failureRedirect: '/' 
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

app.get('/accounts/identity', routes.identity);
app.post('/accounts/identity', postLater);

app.get('/liftoff/login', routes.login);
app.get('/liftoff', routes.index);
app.get('/', routes.index);

//  ------- Launch application -------
var port = process.env.PORT || 3000
app.listen(port, function() {
  console.log('Listening on ' + port)
})
