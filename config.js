module.exports = function(environment) {

  var rObject = {};

  if (environment == 'dev'){

    rObject.db = {
      protocol: 'pg',
      username: 'alexander',
      password: 'testing123',
      port: '5432'
    };

    rObject.app = {
      protocol: 'http',
      hostname: 'localhost',
      ip: '127.0.0.1',
      port: '3000',
    };

    rObject.redis = {
      secret: 'lsfkahfasho124h18087fahg0db0123g12r',
      host: 'localhost',
      port: '6379'
    };

    rObject.fb = {
      app_id: '609051335829720',
      app_secret: '34320f120be92b774111a4f1d6d34743'
    };

    rObject.bc = {
      address: -1,
      account_guid: -1,
      password: -1
    };

  } else if (environment = 'prod') {
    var hidden = require('./routes/cfg.js');

    rObject.app = {
      protocol: 'http',
      hostname: '54.200.103.29',
      ip: '127.0.0.1',
      internal_ip: '172.31.9.227',
      port: '443',
    };

    rObject.redis = {
      secret: hidden.redis_secret,
      host: 'localhost',
      port: '6379'
    };

    rObject.fb = {
      app_id: hidden.fb_id,
      app_secret: hidden.fb_sec
    };

    rObject.bc = {
      address: hidden.main_address,
      id: hidden.guid,
      password: hidden.bcpw
    };
  }

  return rObject;

}
