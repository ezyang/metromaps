// for generating a slideshow panel
// XXX is gonna need to know about the force layout

function slideshow(metro) {
  var current = 0;
  var timeology = 1;
  var focus;
  var steps = [
    {id: 0, title: "Visualizing the News through Metromaps", text: "Our project, Visualizing the News through Metromaps, helps users unfamiliar with a set of news stories better grasp and comprehend the threads between different storylines in the news. In this example, we have a collection of news stories related to the Greek debt crisis, and Dafna's algorithm has generated the significant threads among the stories.", img: "sample.png"},
    {id: 1, title: "Thread 1: debt, austerity, credit", line:"l0", show: "n9572", text: "The first main thread encompasses the keywords \"debt, austery, credit\", and highlights news stories talking directly about Greek debt.  It starts in 2009, when Greek's debt is about to grow to the point where drastic measures will need to be taken."},
    {id: 2, title: "Thread 1: debt, austerity, credit", line:"l0", show: "n13518", text: "At the end, many Greeks realize that there are major problems in Greece that caused the debt crisis."},
    {id: 3, title: "Thread 2: stike, riot, bank", line:"l0", show: "n11072", text: "At the same time, due to certain measures were put into place to try to deal with the problems..."},
    {id: 4, title: "Thread 2: stike, riot, bank", line:"l1", show: "n11324", text: "...they sparked protests and strikes that gradually spread throughout the country."},
    {id: 5, title: "Thread 2: stike, riot, bank", line:"l1", show: "n13913", text: "These protests grew and caused great havoc in the daily lives of most Greeks, but eventually quieted down later. "},
    {id: 6, title: "Greek Debt Crisis Metromap", text: "There were many ongoing and synchronous different threads throughout the crisis, and our visualization is able to capture this data from Dafna's algorithm and lay it out in a very clean and comprehendable format. The visualization highlights for the reader so that he can identify salient threads that have some common player, as well as specific news stories that cover overlapping threads."},
  ];

  var id = fresh("slideshow");
  function showcallback(d) {
    $("#fulltext").empty();
    if (d) {
      d3.html("fulltext/" + d.id.substr(1) + ".html", function(doc) {
        $("#fulltext")
          .append("<h1>"+d.label+"</h1>")
          .append("<p>"+d3.time.format("%Y-%m-%d")(d.date)+"</p>")
          .append(doc);
      });
    }
  };
  metro.showcallback(showcallback);
  var tid = fresh("timeology");
  var lid = fresh("line");
  function json_datas(t, l) {
    if (t == 0) {
      return "sample.json";
    } else {
      if (!l || l == "l0") return "preserving.json";
      else return l + ".json";
    }
  }
  function show_data() {
    d3.json(json_datas(timeology,focus), function(dat) {
      metro.state(dat).focus(focus).animate(1000).stop();
      if (timeology == 0) {
        d3.selectAll(".axis").transition().duration(1000).style("opacity", 0);
      } else {
        d3.selectAll(".axis").transition().duration(1000).style("opacity", 1);
      }
    });
  }
  // CLASSES: page, next, text
  function my(controls, timecontrols, linecontrols, panel) {
    function redraw() {
      my(controls, timecontrols, linecontrols, panel);
    }
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
              .on("change", function(d,i) { current = i; redraw(); });
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
            redraw();
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
      .data([{name: "debt, austerity, credit", focus: "l0", svg_id: "svg_legend", color_id: "color_blue"},
             {name: "strike, riot, bank", focus: "l1", svg_id: "svg_legend", color_id: "color_orange"},
             {name: "germany, euro, merkel", focus: "l2", svg_id: "svg_legend", color_id: "color_green"},
             {name: "imf, fund, strauss", focus: "l3", svg_id: "svg_legend", color_id: "color_red"},
             {name: "view all", svg_id: "svg_legend", color_id: "color_none"},
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
            if (focus != d.focus) {
              focus = d.focus;
              show_data();
            }
          });
        span.insert("label")
          .attr("for", function(_,i) {return lid + i})
          .call(function(label) {
            label.insert("svg")
              .attr("id",function(d,_) {return d.svg_id;})
              .insert("line")
              .attr("id",function(d,_) {return d.color_id;})
              .attr("x1","0")
              .attr("y1","7")
              .attr("x2","15")
              .attr("y2","7");
            label.insert("span").text(function(d) {return d.name});
          });
      })
      ;
    linecontrols.selectAll("input[type=radio]")
        .property("checked", function(d,i) {
          return focus == d.focus;
        });
    linecontrols.jq().buttonsetv();

    //mostly fixed bug by preserving selected state.  but, now sometimes has black text on black background, not very repeatable though.
    focus = steps[current].line;
    show_data();
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

