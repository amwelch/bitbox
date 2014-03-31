var socket;

// DOM Ready =============================================================
$(document).ready(function() {

	socket = io.connect('http://localhost');

  startSocketConnection();

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
		
	});

	socket.on('alert', function(msg) {
		alert(msg.data);
	});
}