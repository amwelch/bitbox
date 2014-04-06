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
      api.getNotifications({id: user.id}, function(err, result) {
        if (err) {
          console.log("ERROR GETTING old_notifications");
        } else {
          if (connections[user.id] != undefined) {            
            console.log("Sending old notifications");
            //TODO: get notify from the user information.         
            connections[user.id].emit('old_notifications', {notis: result.rows}); 
          }
          else {
            console.log("Error with socket when sending the old notifications");
          }
        }        
      });      
		});
	});

	socket.on('disconnect', function() {
		socket.get('user', function (err, user) {
      console.log(user);
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
          api.saveNotification({id: dst_user.id, msg: notify_msg, type: data.type, tx_uuid: data.tx_uuid}, function(err, result) {
            if(err) {
              console.log(err);
            }
            else {
              console.log("Notification saved succesfully")
            }
          });
          if (connections[dst_user.id] != undefined) {            
            // Send the notification only if the socket to the dst user is open
            connections[dst_user.id].emit('notification', {msg: notify_msg, tx_uuid: data.tx_uuid, seen: false}); 
          }
        }
      });
    }
  });
}
