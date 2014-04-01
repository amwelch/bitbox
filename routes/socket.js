
var api = require('./api');

// This is the pool of socket connections.
var connections = require('../app').connections;

exports.socket_connection = function(socket) {

	// Adds the socket to the pool of connections using
	// the user id. 		
	socket.on('user', function(user) {
		socket.set('user', user, function () {			
			console.log('Inside user');
			console.log(user);
			connections[user.id] = socket;
			socket.emit('ready');
		});
	});

	socket.on('disconnect', function() {
		socket.get('user_id', function (err, user) {
			if(err || !user) {
				console.log(err);
			}				
			else {
				console.log('Socket with user_id ' + user.id + ' is disconnected');
				connections[user.id] = undefined;				
			}
		});		
	});  

  // socket.on('msg', function (msg) {
  //   socket.get('nickname', function (err, name) {
  //     console.log('Chat message by ', name);

  //     console.log(msg.data);
  //     setInterval(function(){
  //     	msg.data += counter++;
  //     	socket.emit('msg', {nickname: name.nickname, data: msg.data});
  //     }
  //     	,1000);
  //   });
  // });

  // socket.on('my other event', function (data) {
  //   console.log(data);
  // });	
};

// Socket Notifications API functions
exports.sendNotification = function(users, notification_msg) {
  api.getUser({facebook_id: users.dst_fb_id}, function(err, dst_user) {
    if(err != ec.USER_NOT_FOUND && connections[dst_user.id]) {
      api.getUser({id: users.src_id}, function(err, src_user) {
        if(err) {
          console.log("ERROR GETTING USER in sendNotification");
        }
        else {
          notify_msg = src_user.nickname + notification_msg;
          connections[dst_user.id].emit('notification', {msg: notify_msg}); 
        }
      });
    }
  });
}