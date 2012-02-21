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
	listen, msgEvent, ready, popup, i;

// You're wasting my time!
//if ( !hostWindow ) { return; }

// find the id of this widget in the url
location.search.replace( /(?:\?|&)flId=(\w*?)(?:&|#|$)/, function(a,b) {
	id = b;
});

// find the proxy iframe if the widget is loaded in a popup
// a proxy is required in IE, since window.opener.postMessage is forbiden
if ( isPopup ) {
	i = hostWindow.frames.length;
	while ( i-- ) {
		if ( hostWindow.frames[i].id == id ) {
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
		".flBtn{display:inline-block;font-family:monospace;line-height:18px;font-size:30px;cursor:pointer} " +
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
			type = target.id.replace( /^fl_(\w*?)$/, "$1" );

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

			// open popup
			popup = open( location, "",
				"width=" + ( window.innerWidth || docEl.clientWidth ) +
				",height=" + ( window.innerHeight || docEl.clientHeight )
			);

			// In Chrome, the size of the popup includes the browser chrome.
			// In all browser, the position of the popup is calculated by the host
			// and only available after the popup has been opened
			// Use a setTimeout to fix the size if needed and set the position of the popup
			var height = window.innerHeight;
			setTimeout(function() {
				var diffH = height - popup.innerHeight;
				diffH && popup.resizeBy( 0, diffH );
				popup.moveTo.apply( undefined, position );
			}, 200);

		} else if ( ( type == "close" || type == "togglePop" ) && isPopup ) {
			close();
		}

		!internal && froglet.emit( type, undefined, true );
	}

	body.appendChild( container );

	ready = true;
}

// setup message router
window[ listen ](msgEvent, function( e ) {
	var message = JSON.parse( e.data ),
		type = message.type,
		listeners,
		i;

	// proxy messages to the popup
	if ( message.proxy ) {
		popup.postMessage( e.data, "*" );

	} else if ( message.internal ) {
		type == "pos" ?
			// store position
			position = [ screenX + message.payload[0], screenY + message.payload[1] ] :
			// toggleSize, close, etc.
			container.onclick( { target: document.getElementById( "fl_" + type ) }, true );

	// dispatch payload
	} else if ( ( listeners = routes[ type ] ) ) {
		i = listeners.length;
		while ( i-- ) {
			listeners[i]( message.payload );
		}
	}
}, false);

// API availble to guest window
window.froglet = {
	emit: function( type, payload, internal ) {
		var message = { 
			flId: id,
			type: type
		};

		internal && ( message.internal = internal );
		payload && ( message.payload = payload );

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
	}
};

// overwrite froglet.emit to use a proxy if available
proxy && ( froglet.emit = proxy.froglet.emit );

})(window,document);