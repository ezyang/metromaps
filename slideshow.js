// for generating a slideshow panel
// XXX is gonna need to know about the force layout

function slideshow(metro) {
  var current = 0;
  var timeology = 1;
  var line = 0;
  var steps = [
    {id: 0, title: "Non-linear narrative", text: "People think of time as a linear progression, but actually, it's more like a wibbly wobbly ball of timey wimey stuff.", img: "sample.png"},
    {id: 1, title: "Step 1", text: "First step.", show: "n11072" },
    {id: 2, title: "Step 2", text: "Second step.", show: "n11496" },
  ];
  var id = fresh("slideshow");
  metro.showcallback(function(d) {
    d3.html("fulltext/" + d.id.substr(1) + ".html", function(doc) {
      $("#fulltext").empty().append(doc);
    });
  });
  var tid = fresh("timeology");
  var lid = fresh("line");
  
  // CLASSES: page, next, text
  // XXX todo closure-ify me
  function my(controls, timecontrols, legendcontrols, panel) {

    // The direct-jump numbered buttons: [1] [2] [3]
    controls.selectAll(".page")
      .data(steps, function(_,i) {return i})
      .call(function(page) {
        page.enter()
          .insert("span")
          .attr("class", "page")
          .call(function(span) {
            span.insert("input")
              .attr("type", "radio")
              .attr("name", "tutorial")
              .attr("id", function(_,i) {return id + i})
              .attr("value", function(_,i) {return i})
              .on("change", function(_,i) { current = i; my(controls, timecontrols, legendcontrols, panel); });
            span.insert("label")
              .attr("for", function(_,i) {return id + i})
              .text(function(_,i) {return i+1});
          });
        page.select("input[type=radio]")
          .property("checked", function(_,i) {return i == current});
        page.exit().remove()
      });

    // The next button: [ Next ▸ ]
    controls.selectAll(".next")
      .data([current])
      .call(function(next) {
        next.enter()
          .insert("button")
          .attr("class", "next")
          .on("click", function(d) {
            current = current + 1;
            my(controls, timecontrols, legendcontrols, panel);
          })
          .insert("b").text("Next ▸");
        next.attr("disabled", current == steps.length-1 ? "disabled" : null);
      })

    // jQuery UI to pretty it up
    controls.jq().buttonset();
    // See jQuery UI bug http://bugs.jqueryui.com/ticket/8828
    // and http://bugs.jqueryui.com/ticket/8829
    if (current != steps.length-1) {
      controls.select(".next").jq().button("enable").removeClass("ui-state-hover");
    }

    //topological vs. time
    timecontrols.selectAll(".timeologys")
      .data([{name: "Topological", data: "sample.json"},
             {name: "Time to scale", data: "preserving.json"}
             ])
      .enter()
      .insert("span")
      .attr("class", "timeologys")
      .call(function(span) {
        span.insert("input")
          .attr("type", "radio")
          .attr("name", "timeology")
          .attr("id", function(_,i) {return tid + i})
          .attr("value", function(_,i) {return i})
          .on("change", function(d,i) {
            if (i != timeology) {
              timeology = i;
              d3.json(d.data, function(dat) {
                metro.state(dat).animate(1000).stop();
                if (timeology == 0) {
                  d3.selectAll(".axis").transition().duration(1000).style("opacity", 0);
                } else {
                  d3.selectAll(".axis").transition().duration(1000).style("opacity", 1);
                }
              });
            }
          });
        span.insert("label")
          .attr("for", function(_,i) {return tid + i})
          .text(function(d) {return d.name});
      })
      ;
    timecontrols.selectAll("input[type=radio]")
        .property("checked", function(_,i) {return i == timeology});
    timecontrols.jq().buttonset();

    //legend and highlighting for different lines
    legendcontrols.selectAll(".lines")
      .data([// turn this into a real thing later...
             {name: "None"},
             {name: "L0", data: "preserving.json", focus: "l0"},
             {name: "L1", data: "l1.json", focus: "l1"},
             {name: "L2", data: "l2.json", focus: "l2"},
             {name: "L3", data: "l3.json", focus: "l3"},
             ])
      .enter()
      .insert("span")
      .attr("class", "lines")
      .call(function(span) {
        span.insert("input")
          .attr("type", "radio")
          .attr("name", "line")
          .attr("id", function(_,i) {return lid + i})
          .attr("value", function(_,i) {return i})
          .on("change", function(d,i) {
            if (i != line) {
              line = i;
              d3.json(d.data, function(dat) {
                metro.state(dat).focus(d.focus).animate(1000).stop();
                if (line == 0) {
                  d3.selectAll(".axis").transition().duration(1000).style("opacity", 0);
                } else {
                  d3.selectAll(".axis").transition().duration(1000).style("opacity", 1);
                }
              });
            }
          });
        span.insert("label")
          .attr("for", function(_,i) {return lid + i})
          .text(function(d) {return d.name});
      })
      ;
    legendcontrols.selectAll("input[type=radio]")
        .property("checked", function(_,i) {return i == line});
    legendcontrols.jq().buttonset();

    // The title and description of the page
    panel.selectAll(".text")
      .data([steps[current]], function(d) {return d.id})
      .call(function(n) {
        n.enter()
          .insert("div")
          .attr("class", "text")
          .each(function(d) {
            var div = d3.select(this);
            if (d.img) {
              div.insert("img")
                .attr("src", d.img);
            }
            div.insert("h2")
              .text(d.title);
            div.insert("p")
              .text(d.text);
          });
        n.exit().remove();
      });

    //metro.captionPredicate(steps[current].show || function() {return false;});
    metro.show(steps[current].show || false);
  }
  my.current = function(v) {
    if (!arguments.length) return current;
    current = v;
    return my;
  }
  my.steps = function(v) {
    if (!arguments.length) return steps;
    steps = v;
    return my;
  }
  return my;
}

