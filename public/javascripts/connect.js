// var socket;

// $.cookie.json = true;
// var socket = $.cookie('socket');

// if(socket == undefined) {
console.log("Initializing Socket");
var socket = io.connect('http://localhost');
	// var string_sio = JSON.stringify(socket);
	// console.log(socket);
	// $.cookie('socket', socket, { secure: true } );
startSocketConnection();
// }

socket.on('ready', function() {
	console.log("Ready");
});	

socket.on('notification', function(data) {
	console.log("Inside Notification");
	// document.getElementById("notification_icon").className = "glyphicon glyphicon-asterisk red";
	var bubble = document.getElementById("noti_bubble");
	bubble.innerHTML = '1';
	alert(data.msg);
	// console.log(data);
});

socket.on('old_notifications', function(data) {
	notifications = document.getElementById("notis");
	if(data.notis.length) {
	console.log(data.notis);
		if(data.notify)
			document.getElementById("noti_bubble").innerHTML = data.notis.length;		
		for (var i = 0; i < data.notis.length; i++) {
			var divider = document.createElement('li');
			divider.className = "divider";

			var item = document.createElement('li');
			item.className += "notifications"

			var link = document.createElement('a');
			var url = '/transfer/track/' + data.notis[i].tx_uuid;
			link.href = url;
			link.innerHTML = data.notis[i].msg;

			item.appendChild(link);

			// item.innerHTML = data.notis[i].msg;
			notifications.appendChild(item);
			notifications.appendChild(divider);
		};
	}
	else {
		// Create the list item:
		var item = document.createElement('li');
		item.className += "notifications"

		// Set its contents:
		item.innerHTML = 'No notifications';

		// Add it to the list:
		notifications.appendChild(item);
	}
});

function startSocketConnection() {	
	console.log(socket);
	// jQuery AJAX call for JSON
	$.get( '/api/userInfo', function( data ) {
		socket.emit('user', data);	
	});		
}