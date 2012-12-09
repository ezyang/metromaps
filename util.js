// utility functions

String.prototype.trim=function(){return this.replace(/^\s\s*/, '').replace(/\s\s*$/, '');};
d3.selection.prototype.jq = function() {return $(this.node())}

var freshtable = {};
function fresh(prefix) {
  if (!freshtable[prefix]) {
    freshtable[prefix] = 0;
  }
  var id = "__" + prefix + "_" + freshtable[prefix] + "_";
  freshtable[prefix]++;
  return id;
}

/**
 * A convenient function for taking a transformation (with rotation) on
 * text and modifying it so that it always results in right-up text.
 * Only knows about translate and rotate.  Auto-valigns the text.
 */
function textrotate(transform) {
    return function (node) {
        node.each(function() {
            var t = d3.transform(d3.functor(transform).apply(this, arguments));
            node.attr("alignment-baseline", "central");
            if (t.rotate <= 90 && t.rotate >= -90) {
                node.attr("text-anchor", "begin");
                node.attr("transform", t.toString());
            } else {
                node.attr("text-anchor", "end");
                t.rotate = (t.rotate > 0 ? -1 : 1) * (180 - Math.abs(t.rotate));
                node.attr("transform", t.toString());
            }
        });
    }
}

(function( $ ){
//plugin buttonset vertical
//http://stackoverflow.com/questions/4098054/vertically-displayed-jquery-buttonset
$.fn.buttonsetv = function() {
  $(':radio, :checkbox', this).wrap('<div style="margin: 0px"/>');
  $(this).buttonset();
  $('label:first', this).removeClass('ui-corner-left').addClass('ui-corner-top');
  $('label:last', this).removeClass('ui-corner-right').addClass('ui-corner-bottom');
  mw = 0; // max witdh
  $('label', this).each(function(index){
     w = $(this).width();
     if (w > mw) mw = w; 
  })
  $('label', this).each(function(index){
    $(this).width(mw);
  })
};
})( jQuery );
