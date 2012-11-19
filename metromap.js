// stateful graph, so it can only be used with one set of nodes/links at
// a time
function metromap(svg) {

  // some defaults
  var force = d3.layout.force()
    .charge(-100)
    .gravity(0.1)
    .linkStrength(1)
    .linkDistance(40);

  var paused = false;

  // XXX if the range here starts at 0.2, we get "snap" motion of
  // the metro map, but the force layout doesn't do as well.
  var octoscale = d3.scale.linear().domain([0.1,0]).range([0,1]);

  function redraw() {
    // XXX use precomputed selection for efficiency (but remember to
    // update on changes)
    svg.selectAll("circle")
      .attr("stroke", function (d) { return d.fixed & 1 ? "#EEE" : "#000" })
      .attr("cx", function(d) { return d.x; })
      .attr("cy", function(d) { return d.y; });
    svg.selectAll("line")
      .attr("x1", function(d) { return d.source.x; })
      .attr("y1", function(d) { return d.source.y; })
      .attr("x2", function(d) { return d.target.x; })
      .attr("y2", function(d) { return d.target.y; });
  }

  function maybeResume() {
    // don't resume if paused
    if (!paused) {
      force.resume();
    } else {
      redraw(); // redraw in case someone dragged a node around
    }
  }

  // custom implementation of dragging
  function dragmove(d) {
    var dx = d3.event.x - d.px;
    var dy = d3.event.y - d.py;
    if (d.fixed & 1) {
      force.nodes().forEach(function(node) {
        if (node.fixed & 1) {
          node.px += dx;
          node.py += dy;
          // Also set x,y for when force updating is turned off
          node.x = node.px;
          node.y = node.py;
        }
      });
    } else {
      d.px += dx;
      d.py += dy;
      // ditto
      d.x = d.px;
      d.y = d.py;
    }
    maybeResume();
  }
  // Cribbed from the original drag source.
  var drag = d3.behavior.drag()
        .origin(function(d) {return d})
        .on("dragstart", function(d) {d.fixed |= 2})
        .on("drag", dragmove)
        .on("dragend", function(d) {d.fixed &= 1});

  function mydrag() {
    this.on("mouseover.force", function(d) {d.fixed |= 4})
        .on("mouseout.force", function(d) {d.fixed &= 3})
        .call(drag);
  };

  force.on("tick", function(e) {
    $("#alpha-slider").slider("value", e.alpha);
    $("#alpha-readout").text(e.alpha);
    // enforce octilinearity (hard constraint)
    var k = octoscale(e.alpha);
    force.links().forEach(function(link) {
      // discover the closest octilinear direction (dir is
      // the orthonormal vector for that direction), and then
      // calculate the new link by rotating around the centroid
      // to align with that direction.)
      var v = vec2(link.source, link.target);
      // XXX how to stop overlapping?  nudging the edge too far is
      // not stable...
      // XXX this should respect friction
      var dir = maxr(octilinear, function(x) {return dot(x,v)});
      // XXX refactor me, extra lines for handling 'fixed' nodes
      if (link.source.fixed & 1) {
        var center = vec(link.source);
        var ray = scale(norm(v), dir);
        link.target.x += (center[0] + ray[0] - link.target.x) * k;
        link.target.y += (center[1] + ray[1] - link.target.y) * k;
      } else if (link.target.fixed & 1) {
        var center = vec(link.target);
        var ray = scale(norm(v), dir);
        link.source.x += (center[0] - ray[0] - link.source.x) * k;
        link.source.y += (center[1] - ray[1] - link.source.y) * k;
      } else {
        var center = centroid([vec(link.source), vec(link.target)]);
        var ray = scale(norm(v)/2, dir);
        link.source.x += (center[0] - ray[0] - link.source.x) * k;
        link.source.y += (center[1] - ray[1] - link.source.y) * k;
        link.target.x += (center[0] + ray[0] - link.target.x) * k;
        link.target.y += (center[1] + ray[1] - link.target.y) * k;
      }
    });
    redraw();
  });

  function my() {
    svg.selectAll("circle")
      .data(force.nodes())
      .enter()
      .append("circle")
      .attr("r", 8)
      .attr("stroke", function (d) { return d.fixed & 1 ? "#EEE" : "#000" })
      .attr("stroke-width", 3)
      .attr("fill", "#FFF")
      .attr("cx", function(d) { return d.x; })
      .attr("cy", function(d) { return d.y; })
      .call(mydrag)
      .on("dblclick", function(d) { d.fixed = !d.fixed; });

    svg.selectAll("line")
      .data(force.links())
      .enter()
      .insert("line", "circle")
      .style("stroke", "#000")
      .style("stroke-width", 7);

    force.start();
  }

  var oldAlpha;
  my.paused = function(v) {
    if (!arguments.length) return paused;
    if (v != paused) {
      if (v) {
        oldAlpha = force.alpha();
        force.stop();
      } else {
        force.alpha(oldAlpha);
      }
    }
    paused = v;
    return my;
  }

  function rm(f) {
    return function() {
      var r = f.apply(this, arguments);
      return arguments.length ? my : r;
    }
  }

  my.nodes = rm(force.nodes);
  my.links = rm(force.links);
  my.charge = rm(force.charge);
  my.gravity = rm(force.gravity);
  my.friction = rm(force.friction);
  my.alpha = rm(force.alpha);
  my.linkStrength = rm(force.linkStrength);
  my.linkDistance = rm(force.linkDistance);
  my.size = rm(force.size);
  my.on = rm(force.on);
  my.start = rm(force.start);
  my.stop = rm(force.stop);
  my.tick = rm(force.tick);
  my.resume = rm(force.resume);

  return my;
}
