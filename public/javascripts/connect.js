
console.log("Initializing Socket");
var socket = io.connect('http://localhost');
	
startSocketConnection();

socket.on('ready', function() {
	console.log("Ready");
});	

var count = 0;

function insert_notification(notifications_el, data) {
	var divider = document.createElement('li');
	divider.className = "divider";

	var item = document.createElement('li');
	// item.className += "notifications"

	var link = document.createElement('a');
	var url = '/transfer/track/' + data.tx_uuid;
	link.href = url;
	link.innerHTML = data.msg;

	if(!data.seen)
		count++;

	item.appendChild(link);

	notifications_el.insertBefore(divider, notifications_el.firstChild);
	notifications_el.insertBefore(item, notifications_el.firstChild);
};

socket.on('notification', function(data) {
	console.log("Inside Notification");
	// document.getElementById("notification_icon").className = "glyphicon glyphicon-asterisk red";
	var bubble = document.getElementById("noti_bubble");
	insert_notification(document.getElementById("notis"), data);
	bubble.innerHTML = count;

});

socket.on('old_notifications', function(data) {
	var notifications = document.getElementById("notis");
	console.log(data.notis);
	if(data.notis.length) {		
		for (var i = data.notis.length - 1; i >= 0; i--) {
			insert_notification(notifications, data.notis[i]);
		};

		document.getElementById("noti_bubble").innerHTML = count;		

		var item = document.createElement('li');
		item.className += "notifications"

		var link = document.createElement('a');
		var url = '#';
		link.href = url;
		link.innerHTML = "See All";
		item.appendChild(link);
		notifications.appendChild(item);
	}
	else {
		// Create the list item:
		document.getElementById("noti_bubble").innerHTML = "";
		var item = document.createElement('li');
		item.className += "notifications"

		// Set its contents:
		item.innerHTML = 'No new notifications';

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