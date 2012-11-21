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
 *    are.  Try playing around with the "Octo Force" sliders in the
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
 * Nodes and links require some metadata; maps.html is the canonical
 * source but here is some documentation on what it means:
 *
 * node :: {
 *    id: Unique string identifier for this node, used for making
 *        references from captions
 *    label: String article title
 *    date: Date object of when article was published (XXX not
 *      implemented at the moment)
 *    sx, sy: Advisory x and y coordinates, not used for anything ATM
 *    fixed: Bitmap indicating if the node is fixed w.r.t. force layout
 *    dummy: Whether or not this is a "dummy node".  Dummy nodes do not
 *      have id, label or date fields; they don't represent stories,
 *      just "kinks" in an edge.  They are guaranteed to have exactly
 *      two connecting edges.
 *    dummyLinks: Only set when a node is a dummy, it points to the
 *      unique two connecting edges, such that
 *         dummyLinks[0].target == dummyLinks[1].source
 * }
 *
 * link :: {
 *    source, target: Node objects the link is connected to.  At the
 *      moment, the directionality doesn't mean anything.
 *    path: List of path keys, which identify what paths are flowing
 *      from these nodes
 * }
 *
 * TODO: factor out the pause functionality into its own class, it's
 * pretty useful for debugging force layouts in general!
 */
function metromap(container) {

  var svg = container.append("svg");
  var force = d3.layout.force() // some defaults
    .charge(-100)
    .gravity(0.1)
    .linkStrength(1)
    .linkDistance(40);

  var color             = d3.scale.category10(),
      dur               = 500,
      paused            = false,
      pendingStart      = false, // if start() is called while paused or in view mode
      mode              = MetroMode.EDIT,
      captionPredicate  = function() {return false;};

  // the range of this scale is controlled by 'octoforce'
  var octoscale = d3.scale.linear().domain([0.1,0]).range([0,1]);

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

    // XXX putting this here is pretty expensive, since we need to
    // compute the filter every tick (though fortunately we don't
    // have many nodes)
    // NOTE these go "on top" of nodes and don't need to be accounted for in
    // layout
    // XXX caption width/height should be configurable
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

  // XXX the entire regime here is a little misguided, see also
  // [DRAGUNREGISTER]
  // returns version of function which does nothing if mode != reqmode
  function mkOnly(reqmode) {
    return function(f) {
      return function() {
        if (mode == reqmode) {
          return f.apply(this, arguments);
        }
      }
    }
  }
  var onlyView = mkOnly(MetroMode.VIEW);
  var onlyEdit = mkOnly(MetroMode.EDIT);
  function viewEdit(view, edit) {
    return function() {
      return (mode == MetroMode.VIEW ? view : edit).apply(this, arguments);
    }
  }

  svg.on("click", onlyView(function() {
    captionPredicate = function() {return false;};
    redraw();
  }));

  var dummySelector = svg.insert("circle")
    .attr("class", "dummySelector")
    .attr("r", 4)
    .attr("fill", "#000")
    .attr("pointer-events", "none")
    .style("display", "none");

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
    var cdata = svg.selectAll(".circle")
      .data(force.nodes());
    cdata.exit().remove();
    var circle = cdata.enter()
      .insert("circle", ".dummySelector")
      .attr("class", "circle")
      .attr("cx", function(d) { return d.x; })
      .attr("cy", function(d) { return d.y; })
      // XXX problem: drag still interferes with clicks
      // We really do want to deregister them [DRAGUNREGISTER]
      .call(mydrag)
      // XXX make this hitbox larger
      .on("click", viewEdit(function(d) {
        captionPredicate = function(d2) {return d2 == d}
        d3.event.stopPropagation();
        redraw();
      }, function(d) {
        // Not allowed to delete non-dummies
        if (d3.event.shiftKey && d.dummy) {
          // do-se-do
          var n = d.dummyLinks[0].target;
          d.dummyLinks[0].target = d.dummyLinks[1].target;
          // not necessary, since it will just get deleted
          //d.dummyLinks[1].source = d.dummyLinks[0].source;
          // Warning: O(n) deletion
          force.links().splice(force.links().indexOf(d.dummyLinks[1]), 1);
          force.nodes().splice(force.nodes().indexOf(n), 1);
          my();
        }
      }))
      .on("dblclick", onlyEdit(function(d) { d.fixed = !d.fixed; redraw(); }));

    circle.filter(function(d) {return !d.dummy})
      .attr("r", 8)
      .attr("stroke", function (d) { return d.fixed & 1 ? "#EEE" : "#000" })
      .attr("stroke-width", 3)
      .attr("fill", "#FFF");

    circle.filter(function(d) {return d.dummy})
      .attr("r", 4)
      .attr("fill", function (d) { return d.fixed & 1 ? "#EEE" : "#000" });

    // When there are multiple lines running from a station, we need
    // to offset them from the center. But actually, this is pretty
    // complicated.

    function moveSelector(d) {
      var coords = d3.mouse(svg.node());
      // XXX todo snap to coordinates of true line
      dummySelector.style("display", "inherit")
        .attr("cx", coords[0])
        .attr("cy", coords[1]);
    }
    var ldata = svg.selectAll(".line")
      .data(force.links());
    ldata.exit().remove();
    ldata.enter()
      .insert("line", ".circle")
      .attr("class", "line")
      .style("stroke", function(d) {return d.path.length == 1 ? color(d.path[0]) : "#000"})
      .style("stroke-width", 7)
      .on("mouseover", moveSelector)
      .on("mousemove", moveSelector)
      .on("mouseout", function() {dummySelector.style("display", "none")})
      // XXX bleh names: s/d/l/ or something
      .on("click", function(d) {
        // alright, time to dick around with some node insertion
        var coords = d3.mouse(svg.node());
        var n = {x: coords[0], y: coords[1], dummy: true}
        // XXX length of the resulting links should be adjusted
        var l = {source: n, target: d.target, path: d.path}
        // [DUMMYRENDER]
        // XXX arguably, the way these should be rendered is as a polyline,
        // because we don't want to draw the circle for presentation.
        // (Maybe it should be a polyline for everything!)
        // XXX alternatively, for lines which are single colored, we can
        // draw an appropriately colored circle.  This doesn't work well
        // when multiple paths are involved (though to be fair, we
        // haven't figured out how to draw those yet)
        // XXX two conjoined lines that split up require you to be able
        // to join two dummy nodes together which share a common
        // source/target, e.g.
        force.nodes().push(n);
        force.links().push(l);
        d.target = n;
        // [0].target and [1].source are n by convention
        // XXX add an assert here
        n.dummyLinks = [d, l]
        my(); // needs to update force layout yo
      });

    force.start(); // will call redraw
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

  // apply the accessor function, but in the case of
  // chaining return our closure, not the original
  function rm(f) {
    return function() {
      var r = f.apply(this, arguments);
      return arguments.length ? my : r;
    }
  }

  // only call the function if we're not paused and we're
  // in edit mode
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
    var dummyNodeTransition = svg.selectAll(".circle").filter(function(d) {return d.dummy}).transition().duration(dur);
    if (mode == MetroMode.VIEW) {
      // XXX You can see that there are slight gaps from doing this.
      // See [DUMMYRENDER] for more information.
      dummyNodeTransition.style("opacity", 0);
      force.stop();
    } else {
      dummyNodeTransition.style("opacity", 1);
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
