
/**
 * Module dependencies.
 */

var express = require('express');
var routes = require('./routes');
var auth = require('./routes/auth');

var passport = require('passport');
var FacebookStrategy = require('passport-facebook').Strategy;

var app = express();

app.configure(function() {
	app.use(express.favicon());
	app.set('views', __dirname + '/views');
	app.set('view engine', 'ejs');
	app.use(require('stylus').middleware(__dirname + '/public'));

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
	console.log()
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});

passport.use(
	new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID || '609051335829720',
    clientSecret: process.env.FACEBOOK_SECRET || '34320f120be92b774111a4f1d6d34743',
    callbackURL: 'http://localhost:3000/auth/facebook/callback',
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
//     /auth/facebook/callback
app.get('/auth/facebook',
  passport.authenticate('facebook', { 
  	scope: 'email',
  	authType: 'reauthenticate'
  })
);

// Facebook will redirect the user to this URL after approval.  Finish the
// authentication process by attempting to obtain an access token.  If
// access was granted, the user will be logged in.  Otherwise,
// authentication has failed.
app.get('/auth/facebook/callback', 
  passport.authenticate('facebook', {
  	successRedirect: '/',
		failureRedirect: '/' 
	})
);

app.get('/auth/logout', function(req, res) {
	req.logout();
	res.redirect('/');
});	

//app.get('/in', auth.list);

app.get('/', routes.index);

var port = process.env.PORT || 3000
app.listen(port, function() {
  console.log('Listening on ' + port)
})