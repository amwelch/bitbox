// var socket;

// $.cookie.json = true;
// var socket = $.cookie('socket');

console.log(socket);

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
	console.log(data);
	alert(data.msg);
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