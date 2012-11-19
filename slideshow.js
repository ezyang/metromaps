// for generating a slideshow panel
// XXX is gonna need to know about the force layout

function slideshow() {
  var current = 0;
  var steps = [
    {id: 0, title: "Non-linear narrative", text: "People think of time as a linear progression, but actually, it's more like a wibbly wobbly ball of timey wimey stuff."},
    {id: 1, title: "Step 1", text: "First step."},
    {id: 2, title: "Step 2", text: "Second step."},
  ];
  var id = fresh("slideshow");
  // CLASSES: page, next, text
  // XXX todo closure-ify me
  function my(controls, panel) {

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
              .on("change", function(_,i) { current = i; my(controls, panel); });
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
            my(controls, panel);
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

    // The title and description of the page
    panel.selectAll(".text")
      .data([steps[current]], function(d) {return d.id})
      .call(function(n) {
        n.enter()
          .insert("div")
          .attr("class", "text")
          .call(function(div) {
            div.insert("h2")
              .text(function(d) {return d.title});
            div.insert("p")
              .text(function(d) {return d.text});
          });
        n.exit().remove();
      });
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

