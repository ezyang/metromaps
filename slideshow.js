// for generating a slideshow panel
// XXX is gonna need to know about the force layout

function slideshow(metro) {
  var first = true;
  var current = 0;
  var timeology = 1;
  var focus;
  var steps = [
    {id: 0, title: "Visualizing the News through Metro Maps", img:"greece.png", img_attr:"Bloomberg", text: "<p>Suppose that you are trying to understand the Greek credit crisis.  You decide to read articles published by the New York Times on the subject, and discover that while there are a lot of stories, it is often hard to contextualize any given story: there are multiple narratives, interacting with each other to create a complex web of stories.  How do you navigate these stories? Why, with a metro map, of course!  Metro maps are a technique developed by Dafna Shahaf designed to assist in the understanding of story lines that have nontrivial relationships with one another. You can find the code on <a href='https://github.com/ezyang/metromaps'>GitHub.</a></p>"},
    {id: 1, title: "Greek debt", line:"l0", show: "n9572", img:"austerity.png", img_attr:"Aris Messinis/Agence France-Presse — Getty Images", text: "<p>Each metro line represents distinct story line.  For example, this particular line can be thought of as the main storyline of the Greek credit crisis, starting with statements from Papaconstantinou saying that Greek will control the debt. Focusing on a particular story allows you to read the full text in the right panel.</p>"},
    {id: 2, title: "Evolution over time", line:"l0", show: "n11072", img:"euofficials.png", img_attr:"Olivier Hoslet/European Pressphoto Agency", text: "<p>Each story on the metroline is also positioned according to the time it occured, so as you travel from left to right, stories unfold. On this line, statements by the government were soon followed up with concrete plans for Greek austerity measures, and so on...  However, a story can be an important component of multiple narratives.  For example, while the austerity measures were an important part of the Greek deficit cutting plan...</p>"},
    {id: 3, title: "A branching storyline: strikes and riots", line:"l1", show: "n11324", img:"strike.png", img_attr:"Reuters/Stringer", text: "...these measures also sparked protests and strikes. These events, while related to the Greek credit crisis, can be thought to constitute a distinct storyline from governmental policy.  Thus they live on a different metro line, albeit connected at a key story."},
    {id: 4, title: "Greek Debt Crisis Metromap", img:"acropolis.png", img_attr:"Louisa Gouliamaki/Agence France-Presse — Getty Images", text: "There were many other stories proceeding throughout the crisis, and our visualization is able to display all of this information in a clean and comprehendable format.  Metro maps are not only useful for news, but can be used for many domains of knowledge, including scientific research. We invite you to delve deeper into the Greek credit crisis, using this metro map as your guide."},
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
      d3.selectAll(".axis").transition().duration(1000).style("opacity", timeology == 0 ? 0 : 1);
    });
  }
  // CLASSES: page, next, text
  function my(controls, timecontrols, linecontrols, panel) {
    function redraw() {
      my(controls, timecontrols, linecontrols, panel);
    }
    focus = steps[current].line;
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
              var img_div = div.insert("div").attr("class", "img_div");
              img_div.insert("img")
                .attr("src", d.img)
                .attr("title", d.img_attr);
              img_div.insert("span")
                .attr("class", "img_attr")
                .text(d.img_attr);
            }
            var text_div = div.insert("div").attr("class", "text_div");
            div.insert("h2")
              .text(d.title);
            div.jq().append(d.text);
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

    if (!first) {
      // mostly fixed bug by preserving selected state.  but, now
      // sometimes has black text on black background, not very
      // repeatable though.
      // ezyang: These two functions should not be run the first
      // time we render, esp for debug mode XXX HACK
      show_data();
      metro.show(steps[current].show || false);
      showcallback(steps[current].show || false);
    } else {
      first = false;
    }
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

