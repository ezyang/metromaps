// for generating a slideshow panel
// XXX is gonna need to know about the force layout

function slideshow(metro) {
  var current = 0;
  var timeology = 1;
  var line = 0;
  var focus = "";
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
  function json_datas(t, l) {
    var datas = [
      ["sample.json"],
      ["preserving.json", "preserving.json", "l1.json", "l2.json", "l3.json"]
    ];
    return datas[t][Math.min(l,datas[t].length-1)];
  }
  function show_data() {
    d3.json(json_datas(timeology,line), function(dat) {
      metro.state(dat).focus(focus).animate(1000).stop();
      if (timeology == 0) {
        d3.selectAll(".axis").transition().duration(1000).style("opacity", 0);
      } else {
        d3.selectAll(".axis").transition().duration(1000).style("opacity", 1);
      }
    });
  }
  // CLASSES: page, next, text
  // XXX todo closure-ify me
  function my(controls, timecontrols, linecontrols, panel) {

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
              .on("change", function(_,i) { current = i; my(controls, timecontrols, linecontrols, panel); });
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
            my(controls, timecontrols, linecontrols, panel);
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
      .data([{name: "Topological"},
             {name: "Time to scale"}
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
              show_data();
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
    linecontrols.selectAll(".lines")
      .data([// turn this into a real thing later...
             {name: "no highlight", svg_id: "svg_none"},
             {name: "debt, austerity, credit", data: "preserving.json", focus: "l0", svg_id: "svg_legend", color_id: "color_blue"},
             {name: "strike, riot, bank", data: "l1.json", focus: "l1", svg_id: "svg_legend", color_id: "color_orange"},
             {name: "germany, euro, merkel", data: "l2.json", focus: "l2", svg_id: "svg_legend", color_id: "color_green"},
             {name: "imf, fund, strauss", data: "l3.json", focus: "l3", svg_id: "svg_legend", color_id: "color_red"},
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
              focus = d.focus;
              show_data();
            }
          });
        span.insert("label")
          .attr("for", function(_,i) {return lid + i})
          .text(function(d) {return d.name})
            .insert("svg")
            .attr("id",function(d,_) {return d.svg_id;})
              .insert("line")
              .attr("id",function(d,_) {return d.color_id;})
              .attr("x1","5")
              .attr("y1","7")
              .attr("x2","20")
              .attr("y2","7");
      })
      ;
    linecontrols.selectAll("input[type=radio]")
        .property("checked", function(_,i) {return i == line});
    linecontrols.jq().buttonset();

    //actually show the data
    

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

