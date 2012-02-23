(function(window,document,undefined) {

var hostWindow = ( window.opener || window ).parent,
	docEl = document.documentElement,
	isPopup = !!window.opener,
	id, position,
	proxy,
	_addEventListener = "addEventListener",
	_message = "message",
	routes = {},
	container,
	listen, msgEvent, ready, i;

// find the id of this widget in the url
location.search.replace( /(?:\?|&)flId=(\w*?)(?:&|#|$)/, function(a,b) {
	id = b;
});

// find the proxy iframe if the widget is loaded in a popup
// a proxy is required in IE, since window.opener.postMessage is forbiden
if ( isPopup ) {
	i = hostWindow.frames.length;
	while ( i-- ) {
		if ( hostWindow.frames[i].froglet.id == id ) {
			proxy = hostWindow.frames[i];
			break;
		}
	}
}

// feature detection
if ( _addEventListener in window ) {
	listen = _addEventListener;
	msgEvent = _message;
	document[ listen ]("DOMContentLoaded", insertControls, false);
} else {
	listen = "attachEvent";
	msgEvent = "on" + _message;
	document[ listen ]("onreadystatechange", function() {
		if ( document.readyState == "complete" ) {
			insertControls();
		}
	});
}

function insertControls() {
	// simple way to make sure that froglet is only initialized once
	if ( ready ) { return; }

	var divs = "",
		btns = { close: [ "Close", "\u2297" ]	},
		body = document.body,
		style, btn;

	if ( !isPopup ) {
		btns.toggleSize = [ "Minimize", "\u2296" ],
		btns.togglePosition = [ "Alternate Position", "\u2298" ]
	}
	btns.togglePop = isPopup ? [ "Pop-In", "\u2299" ] : [ "Pop-Out", "\u229A" ];

	style =
		"#fl_controls{position:fixed;top:0;left:0;padding:5px;background:#ccc;height:18px;width:100%;cursor:default;border-bottom:1px solid #666} " +
		".flBtn{display:inline-block;font-family:sans-serif;line-height:16px;font-size:26px;cursor:pointer} " +
		"#fl_controls.flMin{padding:1px} .flMin .flBtn{display:none} .flMin #fl_toggleSize{display:block} .flMin #fl_toggleSize:after{content:'\u2295'}";

	for ( btn in btns ) {
		style += " #fl_" + btn + ":after{content:'" + btns[ btn ][1] + "'}";
		divs += "<div id='fl_" + btn + "' class='flBtn' title='" + btns[ btn ][0] + "'></div>\n";
	}

	style += "#fl_togglePosition:hover:after{content:'\u229b'}";

	container = document.createElement( "div" );
	container.id = "fl_controls";
	container.innerHTML = divs + "&nbsp;<style id='fl_style'>" + style + "</style>";

	// event delegation
	container.onclick = function( e, internal ) {
		var target = e ? e.target : window.event.srcElement,
			type = target.id.replace( /^fl_(\w*?)$/, "$1" ),
			popup, width, height, toClose;

		if ( type == "toggleSize" ) {
			if ( target.title == "Minimize" ) {
				target.title = "Maximize";
				body.style.overflow = "hidden";
				container.className = "flMin";
			} else {
				target.title = "Minimize";
				body.style.overflow = "";
				container.className = "";
			}

		} else if ( type == "togglePop" && !isPopup ) {
			// ask host what is the current position of the widget in the iframe
			froglet.emit( "pos", undefined, true );

			width = ( ( internal && internal[0] ) || window.innerWidth || docEl.clientWidth );
			height = ( ( internal && internal[1] ) || window.innerHeight || docEl.clientHeight );

			// open popup
			froglet.popup = popup = open( location, "",
				"width=" + width +
				",height=" + height
			);

			// In Chrome, the size of the popup includes the browser chrome.
			// In all browser, the position of the popup is calculated by the host
			// and only available after the popup has been opened
			// Use a setTimeout to fix the size if needed and set the position of the popup
			setTimeout(function() {
				var diffH = height - popup.innerHeight;
				diffH && popup.resizeBy( 0, diffH );
				popup.moveTo.apply( popup, position );
			}, 200);

		} else if ( ( type == "close" || type == "togglePop" ) && isPopup ) {
			// "warn" the proxy that there's no more popup
			proxy && ( proxy.froglet.popup = undefined );
			// wait for the last message to be emitted before closing
			toClose = true;
		}

		!internal && froglet.emit( type, undefined, true );
		toClose && close();
	}

	body.appendChild( container );

	ready = true;
}

// message routing
function onmessage( e ) {
	var message = JSON.parse( e.data ),
		type = message.type,
		listeners,
		i;

	// proxy messages to the popup
	if ( froglet.popup && type != "pos" ) {
		froglet.popup.froglet._direct( e );

	} else if ( message.internal ) {
		type == "pos" ?
			// store position
			position = [ ( window.screenX || screenLeft ) + message.payload[0], ( window.screenY || screenTop ) + message.payload[1] ] :
			// toggleSize, close, etc.
			container.onclick( { target: document.getElementById( "fl_" + type ) }, message.payload || true );

	// dispatch payload
	} else if ( ( listeners = routes[ type ] ) ) {
		i = listeners.length;
		while ( i-- ) {
			listeners[i]( message.payload );
		}
	}
}

// setup message router
window[ listen ](msgEvent, onmessage, false);

// API availble to guest window
window.froglet = {
	id: id,

	emit: function( type, payload, internal, jsonPayload ) {
		var message = { 
			flId: id,
			type: type
		};

		internal && ( message.internal = internal );
		payload != undefined && ( message.payload = jsonPayload ? JSON.parse( payload ) : payload );

		hostWindow.postMessage( JSON.stringify( message ), "*" );
	},

	on: function( type, listener ) {
		// create a new route if necessary
		!routes[ type ] && ( routes[ type ] = [] );

		routes[ type ].push( listener );
	},

	off: function( type, listener ) {
		if ( listener && routes[ type ] ) {
			// remove a single listener
			routes[ type ].splice( routes[ type ].indexOf( listener ), 1 );

		// remove a complete route
		} else {
			delete routes[ type ];
		}
	},

	_direct: onmessage
};

// overwrite froglet.emit to use a proxy if available
proxy && ( froglet.emit = function( type, payload, internal ) {
	// IE only support passing strings between window and window.opener
	proxy.froglet.emit( type, JSON.stringify( payload ), internal, true );
});

})(window,document);
