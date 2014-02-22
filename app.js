
/**
 * Module dependencies.
 */

var express = require('express');
var routes = require('./routes');

var passport = require('passport');
var FacebookStrategy = require('passport-facebook').Strategy;

// Used for transactions
var pg = require('pg');

var app = express();

app.configure(function() {
	app.use(express.favicon());
	app.set('views', __dirname + '/views');
	app.set('view engine', 'ejs');
	//app.use(require('stylus').middleware(__dirname + '/public'));

	//app.use(express.static(path.join(__dirname, 'public')));
  app.use(express.static('public'));
  app.use(express.cookieParser());
  app.use(express.bodyParser());
  app.use(express.session({ secret: 'CHANGE ME nonce9001' }));
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(app.router);
});

passport.serializeUser(function(user, done) {
  var projection = {
    firstName: user.name.givenName,
    lastName: user.name.familyName,
    email: user.emails[0].value,
    id: user.id
  };
  console.log("User logged in submitting query");
  /*TODO: For now just create on every login since it will just fail silently
     later check if already exists or insert/update macro or something
  */
  routes.create_user(projection);
  done(null, JSON.stringify(projection));
});

passport.deserializeUser(function(user, done) {
  console.log(user);
  var composition = JSON.parse(user);
  done(null, composition);
});

passport.use( 
	new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID || '609051335829720',
    clientSecret: process.env.FACEBOOK_SECRET || '34320f120be92b774111a4f1d6d34743',
    callbackURL: 'http://localhost:3000/liftoff/login/facebook/callback',
  },
  function(accessToken, refreshToken, profile, done) {
    console.log("---------------------");
    console.log("FBID: " + profile.id);
    console.log("EMAIL: " + profile.emails[0].value);
    console.log("---------------------");
    done(null, profile);
  })
);

// Redirect the user to Facebook for authentication.  When complete,
// Facebook will redirect the user back to the application at
//     /liftoff/login/facebook/callback
app.get('/liftoff/login/facebook',
  passport.authenticate('facebook', { 
  	scope: 'email',
    display: 'popup',
  	authType: 'reauthenticate'
  })
);

// Facebook will redirect the user to this URL after approval.  Finish the
// authentication process by attempting to obtain an access token.  If
// access was granted, the user will be logged in.  Otherwise,
// authentication has failed.
app.get('/liftoff/login/facebook/callback', 
  passport.authenticate('facebook', {
  	successRedirect: '/transfer',
		failureRedirect: '/' 
	})
);

app.get('/logout', function(req, res) {
	req.logout();
	res.redirect('/');
});	

//app.get('/in', auth.list);

app.post('/transfer/pay', function(req, res) {
  console.log(req);
  res.redirect('/transfer/pay');
});

app.get('/transfer/pay', routes.pay);
app.get('/transfer/track', routes.track);
app.get('/transfer/withdraw', routes.withdraw);
app.get('/transfer/deposit', routes.deposit);
app.get('/transfer', routes.transfer);

app.get('/accounts/user', routes.user);
app.get('/accounts/security', routes.security);
app.get('/accounts/identity', routes.identity);
app.post('/accounts/user', routes.userUpdate);
app.post('/accounts/security', routes.securityUpdate);
app.post('/accounts/identity', routes.identityUpdate);

app.get('/liftoff/login', routes.login);
app.get('/liftoff', routes.index);
app.get('/', routes.index);

var port = process.env.PORT || 3000
app.listen(port, function() {
  console.log('Listening on ' + port)
})
