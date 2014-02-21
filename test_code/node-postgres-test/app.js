/*
 The documentation for node postgres can be found here.

 https://github.com/brianc/node-postgres/wiki

 @uthor: Luis
*/
var pg = require('pg');

var dbUrl = "tcp://luis:db2014@localhost/luis";

var rollback = function(client, done) {
  client.query('ROLLBACK', function(err) {
  	console.log("Rolling back!!");
  	console.log(err);
    //if there was a problem rolling back the query
    //something is seriously messed up.  Return the error
    //to the done function to close & remove this client from
    //the pool.  If you leave a client in the pool with an unaborted
    //transaction __very bad things__ will happen.
    return done(err);
  });
};

function testTransaction(onDone) {
	pg.connect(dbUrl, function(err, client, done) {
	  if(err) throw err;
	  client.query('BEGIN', function(err) {
	    if(err) return rollback(client, done);	    
	    //as long as we do not call the `done` callback we can do 
	    //whatever we want...the client is ours until we call `done`
	    //on the flip side, if you do call `done` before either COMMIT or ROLLBACK
	    //what you are doing is returning a client back to the pool while it 
	    //is in the middle of a transaction.  This is __very, very bad__.
	    process.nextTick(function() {
	      var text = 'UPDATE account SET money = money - $1 WHERE id = $2';
	      client.query(text, [100, 1], function(err) {
	        if(err) {
	        	console.error(err);
	        	return rollback(client, done);
	        }	        
	        client.query(text, [-100, 2], function(err) {
	          if(err) return rollback(client, done);	          
	          client.query('COMMIT', done);	          
	        });
	      });
	    });
	  });
	});

	onDone();
}

testTable((function() {
    testTransaction((function() {
    	testTable(disconnectAll);
    }));
}));

function testTable(onDone) {
    pg.connect(dbUrl, function(err, client) {
        client.query("SELECT * FROM account", function(err, result) {
            console.log("Row count: %d",result.rows.length);  // 1
            console.log(result.rows[0]);
            console.log(result.rows[1]);

            onDone();
        });
    });
}

function disconnectAll() {
	console.log("Disconnecting...");
    pg.end();
}


