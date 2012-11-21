/**
 * For development purposes, metro maps are modal.  For
 * normal use, VIEW is the mode
 */
var MetroMode = {
    EDIT: 0, // internal use only (drag behaviors turned on)
    VIEW: 1, // user viewable (clicks open more information about stations)
}

/**
 * This function inserts an SVG element into 'container', and then returns
 * a closure can be invoked to begin rendering the metro map.  Many of
 * the accessors on the closure are the same as force directed layout,
 * here are some of the new ones:
 *
 * captionPredicate
 *    a function which takes a node data element and returns true if the
 *    caption should be shown for this node, and false otherwise.
 *
 *        metro.captionPredicate(function(d) {return d.id == 'n12345'})
 *
 * mode
 *    the mode of the visualization, either MetroMode.VIEW (for end-user
 *    viewing) or MetroMode.EDIT (for development work).  In VIEW mode,
 *    no updates are made to the force layout, and extra interactivity
 *    is enabled.
 *
 *        metro.mode(MetroMode.VIEW)
 *
 * octoforce
 *    The range [0,1] for a linear scale on how strong octilinear forces
 *    are.  Try playing aroudn with the "Octo Force" sliders in the
 *    debug panel to see how these interact with the layout:
 *    essentially, a range near zero will result in no octilinearity,
 *    and a range near one will result in very strict enforcement
 *    of octilinearity.
 *
 *        metro.octoforce([0,1])
 *
 * paused
 *    Pauses the visualization.  When the visualization is paused, all
 *    calls to things that would resume graph layout are silently
 *    intercepted and buffered for when the visualization is unpaused.
 *
 * These accessors directly correspond to their force layout
 * counterparts (though their behavior may be slightly modified):
 *
 *    nodes
 *    links
 *    charge
 *    gravity
 *    friction
 *    linkStrength
 *    linkDistance
 *    size
 *    on
 *    stop
 *    tick
 *    alpha
 *    start
 *    resume
 *
 * TODO: factor out the pause functionality into its own class, it's
 * pretty useful for debugging force layouts in general!
 */
function metromap(container) {

  var svg = container.append("svg");

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

  var captionPredicate = function() {return false;}

  function redraw() {
    // XXX use precomputed selection for efficiency (but remember to
    // update on changes)
    svg.selectAll(".circle")
      .attr("stroke", function (d) { return d.fixed & 1 ? "#EEE" : "#000" })
      .attr("cx", function(d) { return d.x; })
      .attr("cy", function(d) { return d.y; });
    svg.selectAll(".line")
      .attr("x1", function(d) { return d.source.x; })
      .attr("y1", function(d) { return d.source.y; })
      .attr("x2", function(d) { return d.target.x; })
      .attr("y2", function(d) { return d.target.y; });

    // these go "on top" of nodes and don't need to be accounted for in
    // layout
    var capWidth = 240;
    var capHeight = 100;
    var caption = svg.selectAll(".caption").data(force.nodes().filter(captionPredicate), function(n) {return n.id});
    // XXX TODO nice triangle for the things
    caption
      .enter()
      .append("g")
      .attr("class", "caption")
      .insert("foreignObject")
      .attr("width", capWidth)
      // XXX this does poorly if we wrap around to a third line...
      // maybe with the triangle we can just adjust it automatically
      .attr("height", capHeight)
      .attr("x", -capWidth/2)
      .attr("y", -capHeight/2-5)
      .insert("xhtml:div")
      .style("background", "#FFF")
      .style("border", "1px solid #000")
      .style("border-radius", "4px")
      .style("padding", "5px")
      .text(function(d) {return d.label});
    caption
      .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")" });
    caption.exit().remove();
  }

  function mkOnly(sym) {
    return function(f) {
      return function() {
        if (mode == sym) {
          return f.apply(this, arguments);
        }
      }
    }
  }
  var onlyView = mkOnly(MetroMode.VIEW);
  var onlyEdit = mkOnly(MetroMode.EDIT);

  svg.on("click", onlyView(function() {
    captionPredicate = function() {return false;};
    redraw();
  }));

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
  // Cribbed from the original drag source, but with onlyEdit sprayed
  // on all of the handlers
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
    svg.selectAll(".circle")
      .data(force.nodes())
      .enter()
      .append("circle")
      .attr("class", "circle")
      .attr("r", 8)
      .attr("stroke", function (d) { return d.fixed & 1 ? "#EEE" : "#000" })
      .attr("stroke-width", 3)
      .attr("fill", "#FFF")
      .attr("cx", function(d) { return d.x; })
      .attr("cy", function(d) { return d.y; })
      // XXX problem: drag still interferes with clicks
      // We really do want to deregister them
      .call(mydrag)
      // XXX make this hitbox larger
      .on("click", onlyView(function(d) {
        captionPredicate = function(d2) {return d2 == d}
        d3.event.stopPropagation();
        redraw();
      }))
      .on("dblclick", onlyEdit(function(d) { d.fixed = !d.fixed; redraw(); }));

    // When there are multiple lines running from a station, we need
    // to offset them from the center 

    svg.selectAll(".line")
      .data(force.links())
      .enter()
      .insert("line", ".circle")
      .attr("class", "line")
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
  my.size = function(v) {
    if (!arguments.length) return force.size();
    svg.attr("width", v[0]);
    svg.attr("height", v[1]);
    force.size(v);
    return my;
  }
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
  my.captionPredicate = function(v) {
    if (!arguments.length) return captionPredicate;
    captionPredicate = v;
    redraw();
    return my;
  }

  return my;
}
