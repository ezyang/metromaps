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
}

/**
 * This function inserts an SVG element into 'container', and then returns
 * a closure can be invoked to begin rendering the metro map.  Many of
 * the accessors on the closure are the same as force directed layout,
 * here are some of the new ones:
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
 * monoforce
 * timeforce
 *    Similar to octoforce.
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
 * focus
 *    Focus on a specific line ID, or if called with 'false' brings all
 *    lines into focus.
 *
 * show
 *    Focus on a specific stop ID, or if called with 'false' unfocuses
 *    all stops.
 *    XXX Doesn't say what the current focused stop is...
 *
 * showcallback
 *    Callback that is invoked when "show" is called.  Can be generated
 *    by events on the diagram and not just explicit calls.
 *    XXX really ought to be an "on" handler
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
function metromap(container, debug) {

  var margin = {top: 0, right: 70, bottom: 20, left: 70};

  // We need to generate fresh IDs for dummy nodes we create;
  // furthermore, this information must be persisted across
  // getState/setState, since more dummy nodes may be created later.
  var dummyid = 0;

  var realsvg = container.append("svg"),
      axis = realsvg.append("g").attr("class", "axis"),
      svg = realsvg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  var force = d3.layout.force() // some defaults (they're not very good ;-)
    .charge(-100)
    .gravity(0.05)
    .linkStrength(1)
    .linkDistance(80);
  d3_layout_force_pausable(force); // see pforce.js

  // width and height of the text labels; it's OK if they're a little
  // higher than necessary but that can interfere with click hitboxes
  var capWidth = 130,
      capHeight = 64;

  // called when my.show() is invoked; useful because clicks can result in
  // show invocations
  var showcallback = function() {};
  var directions = octilinear;

  var color             = d3.scale.category10(),
      mode              = MetroMode.EDIT,
      lines             = [];

  // the ranges of these scales are controlled by 'octoforce', 'monoforce'
  // and 'timeforce'
  var octoscale = d3.scale.linear().domain([0.1,0]).range([0,0]);
  var monoscale = d3.scale.linear().domain([0.1,0]).range([0,0]);
  var timescale = d3.scale.linear().domain([0.1,0]).range([0,0]);

  // scale for mapping times to x coordinate positions
  var timelate = d3.time.scale();

  function redraw(dur) {
    if (arguments.length < 1) dur = 0;
    // XXX use precomputed selection for efficiency (but remember to
    // update on changes)
    svg.selectAll(".circle")
      .attr("fill", function (d) { return d.selected ? "black" : "white" })
      .attr("r", function (d) { return d.selected ? 16 : d.type != NodeType.DUMMY ? 8 : 4 })
      .transition().duration(dur)
      .attr("stroke", function (d) { return (d.fixed & 1) && mode == MetroMode.EDIT ? "#EEE" : "#000" })
      .attr("cx", function(d) { return d.x; })
      .attr("cy", function(d) { return d.y; })
      .style("opacity", function(d) { return d.unfocus ? 0 : 1 });
    svg.selectAll(".line")
      .transition().duration(dur)
      .attr("x1", function(d) { return d.source.x; })
      .attr("y1", function(d) { return d.source.y; })
      .attr("x2", function(d) { return d.target.x; })
      .attr("y2", function(d) { return d.target.y; });
    // XXX This doesn't work right if the polyline point mapping has
    // changed (dummy nodes were added or removed).  Doing this properly
    // is effort.
    var line = d3.svg.line().x(function(d) {return d.x}).y(function(d) {return d.y});
    svg.selectAll(".metroline")
      .transition().duration(dur)
      .attr("d", function(l) { return line(l.nodes); })
      .style("opacity", function(l) {return l.unfocus ? 0.3 : 1});

    svg.selectAll(".metrotext")
      .transition().duration(dur)
      .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")" })
      .style("opacity", function(d) { return d.unfocus ? 0 : 1 })
      .each(function(d) {
        var fo = d3.select(this).selectAll(".fo");
        fo.transition().duration(dur)
          .attr("x", d.textoffset ? d.textoffset[0] : 0)
          .attr("y", d.textoffset ? d.textoffset[1] : 0);
        fo.selectAll(".thediv")
          .style("background", d.selected ? "rgba(0,0,0,1)" : "rgba(0,0,0,0)")
          .style("color", d.selected ? "white" : "black");
        fo.selectAll(".thespan")
          .style("background", d.selected ? "inherit" : "rgba(255,255,255,0.7)");
      })
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
    // note that this can fairly easily be overridden by the
    // octilinearity constraint
    var k = monoscale(e.alpha);
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
    var k = timescale(e.alpha);
    // another way of doing it: try to enforce "time boundaries"
    force.nodes().forEach(function(node) {
      if (node.type == NodeType.DUMMY) return;
      var dx = node.x - timelate(node.date);
      node.x -= dx * k;
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
      var dir = maxr(directions, function(x) {return dot(x,v)});
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

  function my(dur) {

    timelate.domain(d3.extent(force.nodes(), function(d) {return d.date}));
    axis.transition().call(
            d3.svg.axis().scale(timelate)
              .orient("bottom")
              .ticks(d3.time.months, 1)
              .tickFormat(d3.time.format('%b %Y'))
            );

    var cdata = svg.selectAll(".circle")
      .data(force.nodes());
    cdata.exit().remove();
    var circle = cdata.enter()
      .insert("circle", ".dummySelector")
      .attr("class", "circle")
      .attr("cx", function(d) { return d.x; })
      .attr("cy", function(d) { return d.y; })
      .call(debug ? mydrag : function() {})
      // XXX make this hitbox larger
      .on("click", viewEdit(function(d) {
        my.show(d.id);
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
      .attr("stroke", function (d) { return (d.fixed & 1) && mode == MetroMode.EDIT ? "#EEE" : "#000" })
      .attr("stroke-width", 3)
      .attr("fill", "#FFF");

    circle.filter(function(d) {return d.type == NodeType.DUMMY})
      .attr("r", 4)
      .attr("fill", function (d) { return d.fixed & 1 && mode == MetroMode.EDIT ? "#EEE" : "#000" });

    cdata.filter(function(d) {return d.type == NodeType.DUMMY})
      .style("display", mode == MetroMode.EDIT ? "inherit" : "none");

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

    var textdiv = svg.selectAll(".metrotext")
      .data(force.nodes())
      .enter()
      .insert("g")
      .attr("class", "metrotext")
      .filter(function(d) {return d.type != NodeType.DUMMY})
      .insert("g")
      .attr("transform", "translate("+(-capWidth/2)+","+(-capHeight-10)+")")
      .insert("foreignObject")
      .on("click", onlyView(function(d) {
        my.show(d.id);
        d3.event.stopPropagation();
        redraw();
      }))
      .attr("class", "fo") // see http://stackoverflow.com/questions/11742812/cannot-select-svg-foreignobject-element-in-d3
      .attr("width", capWidth)
      .attr("height", capHeight)
      .call(debug ? d3.behavior.drag()
              .on("dragstart", onlyEdit(function (d) { d.fixed |= 2; }))
              .on("drag", onlyEdit(function(d) {
                var el = d3.select(this);
                if (!d.textoffset) d.textoffset = [0,0];
                if (!d3.event.sourceEvent.shiftKey) {
                  d.textoffset[0] += d3.event.dx;
                } else {
                  d.textoffset[1] += d3.event.dy;
                }
                redraw();
              }))
              .on("dragend", onlyEdit(function(d) { d.fixed &= 1; }))
              : function() {}
              )
      .insert("xhtml:div")
      .style("height", capHeight + "px")
      .style("display", "table-cell")
      .style("font-size", "12px")
      .style("line-height", "1.2")
      .style("vertical-align", "bottom")
      .style("text-align", "center")
      .insert("div")
      .attr("class", "thediv")
      .style("padding", "1px 0 1px 0")
      .style("margin", "0 0 3px 0")
      .style("border-radius", "3px")
      .insert("span")
      .attr("class", "thespan");
    textdiv.insert("span").text(function(d) {return d.label});
    textdiv.insert("br");
    textdiv.insert("span").text(function(d) {return d3.time.format("%Y-%m-%d")(d.date)});

    force.start();
    redraw(dur ? dur : 0); // force a redraw, in case we immediately stop
  }

  realsvg.on("click", onlyView(function() {
    force.nodes().forEach(function(d) { d.selected = false; });
    my.showcallback()();
    redraw();
  }));

  // apply the accessor function, but in the case of
  // chaining return our closure, not the original
  function rm(f) {
    return function() {
      var r = f.apply(this, arguments);
      return arguments.length ? my : r;
    }
  }

  my.octoforce = rm(octoscale.range);
  my.monoforce = rm(monoscale.range);
  my.timeforce = rm(timescale.range);
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
  // XXX dynamic resizing doesn't really work
  my.size = function(v) {
    if (!arguments.length) return force.size();
    var width = v[0];
    var height = v[1];
    realsvg.attr("width", v[0]);
    realsvg.attr("height", v[1]);
    axis.attr("transform", "translate(" + margin.left + "," + (height - margin.bottom) + ")");
    force.size(v);
    timelate.range([0, width-margin.left-margin.right]);
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
    if (mode == MetroMode.VIEW) {
      oldPaused = my.paused();
      my.paused(true);
    } else {
      my.paused(oldPaused);
    }
    return my;
  }
  my.show = function(v) {
    force.nodes().forEach(function(n) {
      if (v && n.type != NodeType.DUMMY && n.id == v) {
        if (n.selected) {
          // re-click should hide it
          showcallback();
          n.selected = false;
        } else {
          showcallback(n)
          n.selected = true;
        }
      } else {
        n.selected = false;
      }
    });
    redraw();
  }
  my.showcallback = function(v) {
    if (!arguments.length) return showcallback;
    showcallback = v;
    return my;
  }

  // essentially, these are copies of nodes/links/lines but with object
  // references replaced with IDs
  function idify(x) { return x.id }
  function getState() {
    fnodes = force.nodes().map(function(x) {
      return {
        id: x.id, label: x.label, date: x.date ? x.date.toString() : undefined, x: x.x, y: x.y, fixed: x.fixed, type: x.type, labelrot: x.labelrot, textoffset: x.textoffset,
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
      octoforce: my.octoforce(), timeforce: my.timeforce(), monoforce: my.monoforce(), charge: my.charge(), gravity: my.gravity(), friction: my.friction(),
      linkStrength: my.linkStrength()(), linkDistance: my.linkDistance()(), size: my.size(), mode: my.mode()};
  }
  function setState(st) {
    if (!st) return;
    var nodemap = d3.map();
    var linemap = d3.map();
    var linkmap = d3.map();
    st.nodes.forEach(function(v) {
      v.date = new Date(v.date); 
      // ezyang: I think this is probably wrong...
      // we should probably store this state not in the nodes
      force.nodes().forEach(function(old_n) {
        v.selected = v.selected || (old_n.selected && old_n.id == v.id);
      });
      nodemap.set(v.id, v);
    });
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
      .monoforce(st.monoforce ? st.monoforce : [0,0])
      .timeforce(st.timeforce ? st.timeforce : [0,0])
      .charge(st.charge)
      .gravity(st.gravity)
      .friction(st.friction)
      .linkStrength(st.linkStrength)
      .linkDistance(st.linkDistance)
      .size(st.size)
      .mode(st.mode);
  }

  // XXX get rid of me
  my.animate = function(dur) {
    my(dur);
    return my;
  }

  my.focus = function(focus) {
    // inverted so that absence == in focus
    force.nodes().forEach(function(n) {
      n.unfocus = focus && n.type != NodeType.DUMMY && !n.edges.has(focus);
    });
    lines.forEach(function(l) {
      l.unfocus = focus && l.id != focus;
    });
    return my;
  }

  my.state = function(v) {
    if (!arguments.length) return getState();
    setState(v);
    return my;
  }

  // needs unit vectors
  my.directions = function(v) {
    if (!arguments.length) return directions;
    directions = v;
    return my;
  }

  return my;
}
