var socket;

var connection = false;

// DOM Ready =============================================================
$(document).ready(function() {

	if (!connection) {
		connection = true;

		socket = io.connect('http://localhost');

	  startSocketConnection();
	}
	// console.log(connection['done']);


});

function startSocketConnection() {
	console.log('HERE!!');
	// jQuery AJAX call for JSON
	$.get( '/api/userInfo', function( data ) {
		console.log(data);
		socket.emit('user', data);	
	});	

	socket.on('ready', function() {
		console.log("Ready");
	});	

	socket.on('notification', function(data) {
		console.log(notification);
		alert(data.msg);
	});

	socket.on('alert', function(msg) {
		alert(msg.data);
	});
}