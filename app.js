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
var routes = require('./routes');

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

app.configure(function() {
	app.use(express.favicon());
	app.set('views', __dirname + '/views');
	app.set('view engine', 'ejs');
	//app.use(require('stylus').middleware(__dirname + '/public'));

	//app.use(express.static(path.join(__dirname, 'public')));
  app.use(express.static('public'));
  app.use(express.cookieParser());
  app.use(express.bodyParser());
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

passport.serializeUser(function(user, done) {
  console.log(user.name);
  var projection = {};
  if ("update" in user){
      delete user["update"];
      projection = user;
      done(null, JSON.stringify(projection));
      return;
  }
  else{
        projection = {
        firstname: user.name.givenName,
        lastname: user.name.familyName,
        email: user.emails[0].value,
        fbid: user.id
      };
  }
  /*Function to add the user if they don't already exist otherwise update in passport*/
  var cb = function(data, passport_data, done){
    if ( !data)
    {
        routes.create_user(passport_data);
        data = passport_data;
    }
    /*TODO: update passport session data*/
    console.log("updating passport...");
    console.log(data);
    console.log("passport_data");
    console.log(passport_data);
    console.log("calling done");
    console.log(done);
    done(null, JSON.stringify(data));
  };

  // TODO: race condition?
  routes.get_user(projection.email, projection, cb, done);
  //Return default data the callback will read from db and populate session with actual data
  //done(null, JSON.stringify(projection));
});

passport.deserializeUser(function(user, done) {
  console.log(user);
  var composition = JSON.parse(user);
  done(null, composition);
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
  start = {
    clientID: process.env.FACEBOOK_APP_ID || '761870430491153',
    clientSecret: process.env.FACEBOOK_SECRET || '9295cdcd4e95c520e5602fe9de90ce8c',
    callbackURL: 'http://'+eip+':443/liftoff/login/facebook/callback',
  };
}

passport.use( 
  new FacebookStrategy(strat, function(accessToken, refreshToken, profile, done) {
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

app.post('/transfer/pay', routes.process_transaction);

app.get('/transfer/pay', routes.pay);
app.get('/transfer/track', routes.track);
app.get('/transfer/withdraw', routes.withdraw);
app.get('/transfer/deposit', routes.deposit);
app.get('/transfer', routes.pay);

app.get('/accounts/user', routes.user);
app.get('/accounts/security', routes.security);
app.get('/accounts/identity', routes.identity);
app.post('/accounts/user', routes.userUpdate);
app.post('/accounts/security', routes.securityUpdate);
app.post('/accounts/identity', routes.identityUpdate);

app.get('/beta', routes.betaSignUp);

app.get('/api/userInfo', routes.userInfo);


app.get('/liftoff/login', routes.login);
app.get('/liftoff', routes.index);
app.get('/', routes.index);

if (dev){
  var port = process.env.PORT || 3000;
  app.listen(port, function() {
    console.log('Listening on ' + port)
  });
}
else{
  app.use(requireHTTPS);
  var options = {
      key: fs.readFileSync(''),
      cert: fs.readFileSync(''),
  }
  var port = process.env.PORT || 443;
  https.createServer(options, app).listen(port, ip, function() {
    console.log('Listening on ' + port);
  });
}
