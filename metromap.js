/**
 * For development purposes, metro maps are modal.  For
 * normal use, VIEW is the mode
 */
var MetroMode = {
    EDIT: 0, // internal use only (drag behaviors turned on)
    VIEW: 1, // user viewable (clicks open more information about stations)
}

var NodeType = {
    PLAIN: 0,       // plain old node, probably is a plain old intersection or single path node
    DUMMY: 1,       // fake station to allow for bending on a line
    SUN: 2,         // centered node that is rendered but not connected to any links
    SATELLITE: 3,   // offset node that is not rendered but connected to links
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
 *    (Implemented by pforce.js)
 *
 * state
 *    A JSON-representable serialization of the entire state of the
 *    force layout; enough information to reconstruct the layout of
 *    the graph.  This includes force layout parameters.
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
 *    date: Date object of when article was published
 *    sx, sy: Advisory x and y coordinates, not used for anything ATM
 *    fixed: Bitmap indicating if the node is fixed w.r.t. force layout
 *    type: What type of node this is, as per NodeType
 *    edges: d3.map of line identifiers to arrays of outgoing edges for
 *      that line
 * }
 *
 * link :: {
 *    id: Unique ID identifying the link
 *    source, target: Node objects the link is connected to.  At the
 *      moment, the directionality doesn't mean anything.
 *    path: List of line objects, which identify what paths are flowing
 *      from these nodes
 * }
 *
 * line :: {
 *   id: Unique ID identifying this line
 *   nodes: Ordered list of nodes on this line
 * }
 *
 * Checkout getState() and setState() for more canonical code.
 *
 */
function metromap(container) {

  var dummyid = 0;

  var svg = container.append("svg");
  var force = d3.layout.force() // some defaults
    .charge(-100)
    .gravity(0.1)
    .linkStrength(1)
    .linkDistance(40);
  d3_layout_force_pausable(force);

  var color             = d3.scale.category10(),
      dur               = 500,
      mode              = MetroMode.EDIT,
      lines             = [],
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
    svg.selectAll(".metrolabel")
      .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; })
      .each(function (d) {
        d3.select(this).selectAll("text").call(textrotate("rotate(" + (d.labelrot ? d.labelrot : 0) + ")translate(12,0)"));
      });
    svg.selectAll(".line")
      .attr("x1", function(d) { return d.source.x; })
      .attr("y1", function(d) { return d.source.y; })
      .attr("x2", function(d) { return d.target.x; })
      .attr("y2", function(d) { return d.target.y; });
    var line = d3.svg.line().x(function(d) {return d.x}).y(function(d) {return d.y});
    svg.selectAll(".metroline")
      .attr("d", function(l) { return line(l.nodes); });

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
      .text(function(d) {return d.label + " : " + d3.time.format("%Y-%m-%d")(d.date)});
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
    .style("visibility", "hidden");

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
    redraw();
    force.resume();
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
    // try to make sure the metro lines have consistent time topology
    var k = e.alpha;
    lines.forEach(function(l) {
      var i;
      for (i = 0; i < l.nodes.length - 1; i++) {
        var begin = l.nodes[i];
        var end = l.nodes[i+1];
        if (begin.x > end.x) {
          var delta = begin.x - end.x;
          begin.x -= delta/2 * k;
          end.x += delta/2 * k;
        }
        if (begin.y > end.y) {
          var delta = begin.y - end.y;
          begin.y -= delta/2 * k;
          end.y += delta/2 * k;
        }
      }
    });
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
        if (d3.event.shiftKey && d.type == NodeType.DUMMY) {
          // do-se-do
          // XXX I'm not convinced this works when multiple edges are
          // involved
          var dlinks = d.edges.values()[0];
          var n = dlinks[0].target;
          dlinks[0].target = dlinks[1].target;
          // not necessary, since it will just get deleted
          //dlinks[1].source = dlinks[0].source;
          // Warning: O(n) deletion
          force.links().splice(force.links().indexOf(dlinks[1]), 1);
          force.nodes().splice(force.nodes().indexOf(n), 1);
          // don't forget to kill the link owner
          dlinks[0].path.forEach(function(l) {
            l.nodes.splice(l.nodes.indexOf(d), 1);
          });
          my();
        }
      }))
      .on("dblclick", onlyEdit(function(d) { d.fixed = !d.fixed; redraw(); }));

    circle.filter(function(d) {return d.type != NodeType.DUMMY})
      .attr("r", 8)
      .attr("stroke", function (d) { return d.fixed & 1 ? "#EEE" : "#000" })
      .attr("stroke-width", 3)
      .attr("fill", "#FFF");

    circle.filter(function(d) {return d.type == NodeType.DUMMY})
      .attr("r", 4)
      .attr("fill", function (d) { return d.fixed & 1 ? "#EEE" : "#000" });

    function moveSelector(d) {
      var coords = d3.mouse(svg.node());
      // XXX todo snap to coordinates of true line
      dummySelector.style("visibility", "visible")
        .attr("cx", coords[0])
        .attr("cy", coords[1]);
    }
    var ldata = svg.selectAll(".line")
      .data(force.links());
    ldata.exit().remove();
    ldata.enter()
      .insert("line", ".circle")
      .attr("class", "line")
      .style("opacity", 0.5)
      .style("stroke", "#000")
      .style("visibility", "hidden")
      .style("pointer-events", "all")
      .style("stroke-width", 9)
      .on("mouseover", onlyEdit(moveSelector))
      .on("mousemove", onlyEdit(moveSelector))
      .on("mouseout", onlyEdit(function() {dummySelector.style("visibility", "hidden")}))
      // XXX bleh names: s/d/l/ or something
      .on("click", onlyEdit(function(d) {
        // alright, time to dick around with some node insertion
        var coords = d3.mouse(svg.node());
        var n = {id: "dummy" + dummyid, x: coords[0], y: coords[1], type: NodeType.DUMMY, edges: d3.map()}
        // XXX length of the resulting links should be adjusted
        var l = {id: "dummy" + dummyid, source: n, target: d.target, path: d.path}
        dummyid++;
        d.path.forEach(function(p) {
          n.edges.set(p.id, [d, l]);
        });
        // XXX two conjoined lines that split up require you to be able
        // to join two dummy nodes together which share a common
        // source/target, e.g.
        force.nodes().push(n);
        force.links().push(l);
        d.target = n;
        // need to update affected lines too
        d.path.forEach(function(line) {
          var i = line.nodes.indexOf(d.source);
          if (line.nodes[i+1] == l.target) {
            line.nodes.splice(i+1, 0, n);
          } else {
            // assert line.nodes[i-1] == n.target
            line.nodes.splice(i, 0, n);
          }
        });
        my(); // needs to update force layout yo
      }));

    // When there are multiple lines running from a station, we need
    // to offset them from the center. But actually, this is pretty
    // complicated.

    svg.selectAll(".metroline")
      .data(lines)
      .enter()
      .insert("path", ".line")
      .attr("class", "metroline")
      .style("stroke", function(l) {return color(l.id)})
      .style("stroke-width", 7)
      // pick some nice stroke rounding algo
      .style("fill", "none");

    svg.selectAll(".metrolabel")
      .data(force.nodes())
      .enter()
      .insert("g")
      .attr("class", "metrolabel")
      .filter(function(d) {return d.type != NodeType.DUMMY})
      .insert("text")
      .attr("fill", "black")
      .text(function(d) {return d.shortlabel ? d.shortlabel : d.label.substr(0, 8)})
      .call(d3.behavior.drag()
              .on("dragstart", onlyEdit(function (d) { d.fixed |= 2; }))
              .on("drag", onlyEdit(function(d) {
                var coord = d3.mouse(svg.node());
                var dx = coord[0] - d.x;
                var dy = coord[1] - d.y;
                d.labelrot = Math.atan2(dy,dx) * 180 / Math.PI;
                if (d3.event.sourceEvent.shiftKey) { // odd...
                  // snap to
                  d.labelrot = Math.round(d.labelrot / 45) * 45
                }
                redraw();
              }))
              .on("dragend", onlyEdit(function(d) { d.fixed &= 1; }))
              );

    force.start();
    redraw(); // force a redraw, in case we immediately stop
  }

  // apply the accessor function, but in the case of
  // chaining return our closure, not the original
  function rm(f) {
    return function() {
      var r = f.apply(this, arguments);
      return arguments.length ? my : r;
    }
  }

  my.octoforce = rm(octoscale.range);
  my.nodes = rm(force.nodes);
  my.links = rm(force.links);
  my.lines = function(v) {
    if (!arguments.length) return lines;
    lines = v;
    return my;
  }
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
  my.alpha = rm(force.alpha);
  my.start = rm(force.start);
  my.resume = rm(force.resume);
  my.paused = rm(force.paused);
  var oldPaused;
  my.mode = function(v) {
    if (!arguments.length) return mode;
    mode = v;
    var dummyNodeTransition = svg.selectAll(".circle").filter(function(d) {return d.type == NodeType.DUMMY}).transition().duration(dur);
    if (mode == MetroMode.VIEW) {
      dummyNodeTransition.style("opacity", 0);
      oldPaused = my.paused();
      my.paused(true);
    } else {
      dummyNodeTransition.style("opacity", 1);
      my.paused(oldPaused);
    }
    return my;
  }
  my.captionPredicate = function(v) {
    if (!arguments.length) return captionPredicate;
    captionPredicate = v;
    redraw();
    return my;
  }

  // essentially, these are copies of nodes/links/lines but with object
  // references replaced with IDs
  function idify(x) { return x.id }
  function getState() {
    fnodes = force.nodes().map(function(x) {
      return {
          id: x.id, label: x.label, date: x.date, x: x.x, y: x.y, fixed: x.fixed, type: x.type, labelrot: x.labelrot,
        edges: x.edges.entries().map(function(kv) {kv.value = kv.value.map(idify); return kv;})
      }
    });
    flines = lines.map(function(x) {
      return {id: x.id, nodes: x.nodes.map(idify)}
    });
    flinks = force.links().map(function(x) {
      return {id: x.id, source: x.source.id, target: x.target.id, path: x.path.map(idify)}
    });
    return {nodes: fnodes, lines: flines, links: flinks,
      dummyid: dummyid,
      octoforce: my.octoforce(), charge: my.charge(), gravity: my.gravity(), friction: my.friction(),
      linkStrength: my.linkStrength()(), linkDistance: my.linkDistance()(), size: my.size(), mode: my.mode()};
  }
  function setState(st) {
    if (!st) return;
    var nodemap = d3.map();
    var linemap = d3.map();
    var linkmap = d3.map();
    st.nodes.forEach(function(v) {nodemap.set(v.id, v)});
    st.lines.forEach(function(v) {linemap.set(v.id, v)});
    st.links.forEach(function(v) {linkmap.set(v.id, v)});
    function unid(map) {return function(v) {return map.get(v)}}
    // recompute links and maps
    nodemap.forEach(function(_,x) {
      var edges = d3.map();
      if (x.edges) {
        x.edges.forEach(function(kv) {
          edges.set(kv.key, kv.value.map(unid(linkmap)));
        });
        x.edges = edges;
      }
    });
    linemap.forEach(function(_,x) {
      x.nodes = x.nodes.map(unid(nodemap));
    });
    linkmap.forEach(function(_,x) {
      x.source = unid(nodemap)(x.source);
      x.target = unid(nodemap)(x.target);
      x.path = x.path.map(unid(linemap));
    });
    //console.log(flinks.map(function(x) {return x.path}));
    dummyid = st.dummyid;
    my.nodes(nodemap.values())
      .lines(linemap.values())
      .links(linkmap.values())
      .octoforce(st.octoforce)
      .charge(st.charge)
      .gravity(st.gravity)
      .friction(st.friction)
      .linkStrength(st.linkStrength)
      .linkDistance(st.linkDistance)
      .size(st.size)
      .mode(st.mode);
  }

  my.state = function(v) {
    if (!arguments.length) return getState();
    setState(v);
    return my;
  }

  return my;
}
