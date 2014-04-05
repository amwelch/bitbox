var ec = require('../api/error-codes.js');
var api = require('../api/');

// This is the pool of socket connections.
var connections = {};

exports.socket_connection = function(socket) {
	// Adds the socket to the pool of connections using
	// the user id. 		
	socket.on('user', function(user) {
		socket.set('user', user, function () {						
			connections[user.id] = socket;
			socket.emit('ready');      
      api.getNotifications({id: user.id}, function(err, notis, user_data) {
        if (err) {
          console.log("ERROR GETTING old_notifications");
        } else {
          socket.emit('old_notifications', notis);
        }        
      });      
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
};

// Socket Notifications API functions
exports.sendNotification = function(data, notification_msg) {
  api.getUser({facebook_id: data.dst_fb_id}, function(err, dst_user) {
    if(err != ec.USER_NOT_FOUND) {
      api.getUser({id: data.src_id}, function(err, src_user) {
        if (err) {
          console.log("ERROR GETTING USER in sendNotification");
        } else {
          notify_msg = src_user.nickname + notification_msg;
          console.log("----------------->>>>About to send connection to dst user");
          api.saveNotification({id: dst_user.id, msg: notify_msg, type: data.type});
          if (connections[dst_user.id] != undefined) {            
            // Send the notification only if the socket to 
            // the dst user is open            
            connections[dst_user.id].emit('notification', {msg: notify_msg}); 
            console.log("----------------->>>>Notification sent!");
          } else {
            // Add this notification to the notifications table
            console.log("----------------->>>>Saving notification to db");
          }
        }
      });
    }
  });
}

exports.oldNotifications = function(data, id) {
  console.log(data);
  if (connections[id] != undefined) {            
    console.log("Sending old notifications");
    //TODO: get this from the user information.         
    connections[id].emit('old_notifications', {notify: true, notis: data}); 
  }
  else {
    console.log("Error sending the old notifications");
  }
}