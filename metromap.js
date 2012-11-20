// stateful graph, so it can only be used with one set of nodes/links at
// a time

var MetroMode = {
    EDIT: 0, // internal use only (drag behaviors turned on)
    VIEW: 1, // user viewable (clicks open more information about stations)
}

function metromap(svg) {

  // some defaults
  var force = d3.layout.force()
    .charge(-100)
    .gravity(0.1)
    .linkStrength(1)
    .linkDistance(40);

  var color = d3.scale.category10();

  var paused = false;
  var pendingStart = false;

  var mode = MetroMode.EDIT;

  // the range of this scale is controlled by 'octoforce'
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

  function onlyEdit(f) {
    return function() {
      if (mode == MetroMode.EDIT) {
        return f.apply(this, arguments);
      }
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
        .on("dragstart", onlyEdit(function(d) {d.fixed |= 2}))
        .on("drag", onlyEdit(dragmove))
        .on("dragend", onlyEdit(function(d) {d.fixed &= 1}));

  function mydrag() {
    this.on("mouseover.force", onlyEdit(function(d) {d.fixed |= 4}))
        .on("mouseout.force", onlyEdit(function(d) {d.fixed &= 3}))
        .call(drag);
  };

  force.on("tick", function(e) {
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
      .on("click", function() {console.log("click detected")})
      .on("dblclick", function(d) { d.fixed = !d.fixed; redraw(); });

    // When there are multiple lines running from a station, we need
    // to offset them from the center 

    svg.selectAll("line")
      .data(force.links())
      .enter()
      .insert("line", "circle")
      .style("stroke", function(d) {return d.path.length == 1 ? color(d.path[0]) : "#000"})
      .style("stroke-width", 7);

    force.start();
  }

  var oldAlpha;
  my.paused = function(v) {
    if (!arguments.length) return paused;
    if (mode != MetroMode.EDIT) return my;
    if (v != paused) {
      if (v) {
        oldAlpha = force.alpha();
        force.stop();
      } else {
        if (pendingStart) {
          force.start();
          pendingStart = false;
        }
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

  function notPaused(f) {
    return function() {
      if (!paused && mode == MetroMode.EDIT) {
        f();
      } else {
        redraw(); // redraw in case someone dragged a node around
        if (f == force.start) pendingStart = true;
      }
      return my;
    }
  }

  var maybeResume = notPaused(force.resume);

  my.octoforce = rm(octoscale.range);
  my.nodes = rm(force.nodes);
  my.links = rm(force.links);
  my.charge = rm(force.charge);
  my.gravity = rm(force.gravity);
  my.friction = rm(force.friction);
  my.linkStrength = rm(force.linkStrength);
  my.linkDistance = rm(force.linkDistance);
  my.size = rm(force.size);
  my.on = rm(force.on);
  my.stop = rm(force.stop);
  my.tick = rm(force.tick);
  my.alpha = function(v) {
    if (!arguments.length) return paused ? oldAlpha : force.alpha();
    if (paused) {
      oldAlpha = v;
    } else {
      if (mode == MetroMode.EDIT) force.alpha(v);
    }
    return my;
  }
  my.start = notPaused(force.start);
  my.resume = notPaused(force.resume);
  my.mode = function(v) {
    if (!arguments.length) return mode;
    mode = v;
    if (mode == MetroMode.VIEW) {
      force.stop();
    }
    return my;
  }

  return my;
}
