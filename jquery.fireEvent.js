/*
  jQuery-fireEvent v0.2, by Francois-Guillaume Ribreau.

  http://blog.fgribreau.com/2010/08/jquery-fireevent-plugin-for-firing-real.html

  Copyright (c)2010 Francois-Guillaume Ribreau. All rights reserved.
  Released under the Creative Commons BY-SA Conditions.
    http://creativecommons.org/licenses/by-sa/3.0/

  Usage:
    $('#button').fireEvent('click').text('Event sent');
*/

(function($, undefined) {

	$.fireEvent = function(el, eventName, opt) {
		if (el === undefined)
			return false;
		
		if('jquery' in el){
		  el = el[0];
		}

    if(!evts[eventName]){
			return false;
    }
    
    var evt;
    
		if (typeof(document.createEvent) != 'undefined') {//W3C way
			evt = document.createEvent(evts[eventName].w3c);
			evts[eventName].initEvt(evt, el, opt);
			el.dispatchEvent(evt);

		} else {//IE
			if (eventName == 'click') { 
				// we use jquery to fire the click event because of a bug in IE7-8
				$(el).click();
			} else {
				el.fireEvent(evts[eventName].ie);
			}
		}
	};

	$.fn.fireEvent = function(eventName, opt) {
		if (this.length == 0)
			return this;

		$.fireEvent.call({},this[0], eventName, opt);

		return this;
	};

	/* -- Event cross-browser implementation -- */
	var evts = {
		'click': {//Tested/Work with Firefox 3.6 & Safari 5.0.1 & Chromium 6.0
			ie: 'onclick',
			w3c: 'MouseEvents',
			initEvt: function(evt, target, opt) {
				var _def = $.extend({
						type: 'click',
						canBubble: true,
						cancelable: true,
						view: window,
						detail: 1,
						screenX: 1,
						screenY: 1,
						clientX: 1,
						clientY: 1,
						ctrlKey: false,
						altKey: false,
						shiftKey: false,
						metaKey: false,
						button: 0,
						relatedTarget: target}, opt);

				evt.initMouseEvent(_def.type,
				_def.canBubble, _def.cancelable, _def.view, _def.detail,
				_def.screenX, _def.screenY, _def.clientX, _def.clientY,
				_def.ctrlKey, _def.altKey, _def.shiftKey, _def.metaKey, _def.button, _def.relatedTarget);
			}
		},

		'dblclick': {//Tested/Work with Firefox 3.6 & Safari 5.0.1 & Chromium 6.0
			ie: 'ondblclick',
			w3c: 'MouseEvents',
			initEvt: function(evt, target, opt) {
				evts['click'].initEvt(evt, target, $.extend({type: 'dblclick'}, opt));
			}
		},

		'keyup': {//Tested/Work with Firefox 3.6 & Safari 5.0.1 & Chromium 6.0 (not opera)
			ie: 'onkeyup',
			w3c: 'KeyboardEvent',
			initEvt: function(evt, target, opt) {
				var _def = $.extend({keyCode: null, CharCode: null}, opt);
        //initKeyboardEvent doesn't work with Opera (tested with Firefox 3.6 & Safari 5.0.1)
				evt.initKeyboardEvent('keyup', true, true, window, false, false, false, false, _def.keyCode, _def.CharCode)
			}

		},
		
		'blur': {//Tested/Work with Firefox 3.6 & Safari 5.0.1 & Chromium 6.0
			ie: 'onblur',
			w3c: 'HTMLEvents',
			initEvt: function(evt, target, opt) {
				evt.initEvent('blur', true, true);
			}

		},
		
		'change': {//Tested/Work with Firefox 3.6 & Safari 5.0.1 & Chromium 6.0
			ie: 'onchange',
			w3c: 'HTMLEvents',
			initEvt: function(evt, target, opt) {
				evt.initEvent('change', true, true);
			}
		}
	};

})(jQuery);