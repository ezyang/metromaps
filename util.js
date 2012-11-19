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

