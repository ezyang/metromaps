// --- mini vector library --------------------------------------------
// vectors are arrays [x,y] (2-dimensional)
// I cannae believe D3.js has no vector operations

var octilinear = function() {
  var x = 1/Math.sqrt(2);
  return [[1,0],[x,x],[0,1],[-x,x],[-1,0],[-x,-x],[0,-1],[x,-x]]
}();

var hexilinear = function() {
  var x = Math.sqrt(3)/2;
  return [[1,0],[1/2,x],[-1/2,x],[-1,0],[-1/2,-x],[1/2,-x]]
}();

function dot(v1, v2) { // V -> V -> R
  return v1[0] * v2[0] + v1[1] * v2[1];
}
function centroid(vs) { // [V] -> V
  function c(i) { return d3.sum(vs, function(v) {return v[i]})/vs.length; }
  return [c(0), c(1)];
}
function scale(k, v) { // R -> V -> V
  return [k*v[0], k*v[1]];
}
function norm(v) { // V -> R (Euclidean)
  return Math.sqrt(v[0]*v[0]+v[1]*v[1]);
}
function vec(p) { // {x:R, y:R} -> V
  return [p.x,p.y];
}
function vec2(p1,p2) { // {x:R, y:R} -> {x:R, y:R} -> V (from p1 to p2)
  return [p2.x-p1.x, p2.y-p1.y];
}
function maxr(as, f) { // returns the value that is max by f (not f(v))
  var m = as[0], fm = f(as[0]);
  as.forEach(function(a) {var fa = f(a); if (fa > fm) {m = a; fm = fa}});
  return m;
}
