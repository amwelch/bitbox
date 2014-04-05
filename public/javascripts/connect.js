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
	// document.getElementById("notification_icon").className = "glyphicon glyphicon-asterisk red";
	var bubble = document.getElementById("noti_bubble");
	bubble.style.visibility="visible";
	bubble.innerHTML = "1";
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
			var item = document.createElement('li');
			item.innerHTML = data.notis[i].memo;
			notifications.appendChild(item);
		};
	}
	else {
		// Create the list item:
		var item = document.createElement('li');

		// Set its contents:
		item.innerHTML = 'No notifications';

		// Add it to the list:
		notifications.appendChild(item);
	}
});

socket.on('alert', function(msg) {
	alert(msg.data);
});

function startSocketConnection() {
	console.log('HERE!!');
	// jQuery AJAX call for JSON
	$.get( '/api/userInfo', function( data ) {
		console.log(data);
		socket.emit('user', data);	
	});		
}