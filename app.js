//  Determine ENV
var args = process.argv.slice(2);
ENVIRONMENT = 'prod';
if (args.indexOf('dev') != -1){
    ENVIRONMENT = 'dev';
}

var express = require('express');
var cfg = require('./config.js')(ENVIRONMENT);
var sprintf = require("sprintf-js").sprintf; 
var passport = require('passport');
var FacebookStrategy = require('passport-facebook').Strategy;
var RedisStore = require("connect-redis")(express);
REDIS = new RedisStore({
  host: cfg.redis.host,
  port: cfg.redis.port,
  //db: 
  //pass: 
});

var fs = require('fs');
var app = express();

var http = require('http');
var https = require('https');

//  Rendering
var routes = require('./routes');

var ec = require('./routes/error-codes');

//  ------- Server Configuration -------
var app = express();  
app.configure(function() {
  app.use(express.favicon());
  if(dev) {
    app.set('port', process.env.PORT || 3000);
  }
  else {
    app.set('port', process.env.PORT || 443);
  }
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(express.static('public'));
  app.use(express.cookieParser());
  //app.use(express.bodyParser()); // Replaced by following 2 lines:
  app.use(express.json());       // to support JSON-encoded bodies
  app.use(express.urlencoded()); // to support URL-encoded bodies
  app.use(express.session({ 
    secret: cfg.redis.secret,
    store: REDIS,
    //cookie: { secure: true }
  }));
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
    clientID: process.env.FACEBOOK_APP_ID || cfg.fb.app_id,
    clientSecret: process.env.FACEBOOK_SECRET || cfg.fb.app_secret,
    callbackURL: sprintf('%s://%s:%s/liftoff/login/facebook/callback', cfg.app.protocol, cfg.app.hostname, cfg.app.port),
  },
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

//  ------- Sockets Configuration -------
// Sockets used for notifications
// TODO: we need to use https for the sockets as well
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);

// Handlers for socket events
var sio = require('./routes/socket');

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

app.get('/deposit/blockchain', routes.blockChainIn);

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

var port = process.env.PORT || cfg.app.port;

/*
https

function requireHTTPS(req, res, next) {
    if (!req.secure){
        return res.redirect('https://' + req.get('host') + req.url);
    }
    next();

}
app.use(requireHTTPS);

var options = {
    key: fs.readFileSync('/keykeeper.pem'),
    cert: fs.readFileSync('/bbcsr.pem')
};
https.createServer(options, app).listen(443);
*/

http.createServer(app).listen(port);
