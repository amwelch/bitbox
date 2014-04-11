
// console.log("Initializing Socket");
var socket;
if (document.domain == "localhost") {
	socket = io.connect('http://localhost');
} else {
	var socketAddr = 'https://www.bit-box.org:443';
	socket = io.connect(socketAddr, {'flash policy port':443});
}
	
startSocketConnection();

socket.on('ready', function() {
	// console.log("Ready");
});	

var count = 0;
var no_new = false;

function insert_notification(notifications_el, data) {
	var divider = document.createElement('li');
	divider.className = "divider";

	var item = document.createElement('li');
	// item.className += "notifications"

	var link = document.createElement('a');
	var url = '/transfer/track/' + data.tx_uuid;
	link.href = url;
	link.innerHTML = data.msg;

	if(!data.seen) {
		count++;
	}
	else {
		item.className += "seen";		
	}

	item.appendChild(link);

	notifications_el.insertBefore(divider, notifications_el.firstChild);
	notifications_el.insertBefore(item, notifications_el.firstChild);
};

function update_bubble() {
	var bubble = document.getElementById("noti_bubble");
	if(count) {
		bubble.innerHTML = count;
		bubble.className = "noti_bubble";
	}
}

socket.on('old_notifications', function(data) {
	var notifications = document.getElementById("notis");
	// console.log(notifications);
	if(data.notis.length) {		
		for (var i = data.notis.length - 1; i >= 0; i--) {
			insert_notification(notifications, data.notis[i]);
		};

		update_bubble();

	}
	else {
		// Create the list item:
		var item = document.createElement('li');
		item.className += "notifications"
		
		item.setAttribute("id", "no_new");
		item.innerHTML = "No new notifications";

		var divider = document.createElement('li');
		divider.setAttribute("id", "no_new_divider");
		divider.className = "divider";

		no_new = true;

		// Add it to the list:
		notifications.appendChild(item);
		notifications.appendChild(divider);
	}

	var item = document.createElement('li');
	item.className += "notifications"

	var link = document.createElement('a');
	var url = '#';
	link.href = url;
	link.innerHTML = "See All";
	item.appendChild(link);
	notifications.appendChild(item);
});

socket.on('notification', function(data) {
	// console.log("Inside Notification");
	var notifications = document.getElementById("notis");

	if(no_new) {
		// console.log("DELETING NO NEW NOTIFICATIONS")
		var li = document.getElementById("no_new");
		var di = document.getElementById("no_new_divider");
		notifications.removeChild(li);
		notifications.removeChild(di);
	}

	insert_notification(notifications, data);
	update_bubble();

});

function startSocketConnection() {	
	// console.log(socket);
	// jQuery AJAX call for JSON
	$.get( '/api/userInfo', function( data ) {
		socket.emit('user', data);	
	});		
}
