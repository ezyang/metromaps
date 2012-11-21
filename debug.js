function debugForce(force, selection) {

  var div = selection.insert('div');
  // booleans are inverted XXX fix the naming
  var pause = div.insert("input") // special support for pause
    .attr("type", "checkbox")
    .attr("id", "debugpause")
    .property("checked", !force.paused())
    .on("change", function() {
        force.paused(!this.checked);
        pause.jq().button({ icons: { primary: !this.checked ? "ui-icon-play" : "ui-icon-pause" }, text: false });
    });
  div.insert("label").attr("for", "debugpause").text("Run");
  pause.jq().button({ icons: { primary: "ui-icon-pause" }, text: false });
  var buttons =
      [ {name: "Restart",     f: function() { pause.property("checked", !false); // XXX annoying
                                              force.paused(false);
                                              pause.jq().button({ icons: { primary: "ui-icon-pause" }, text: false });
                                              pause.jq().button("refresh");
                                              force.start(); } },
        {name: "Clear fixed", f: function() { force.nodes().forEach(function(n) {n.fixed = 0;}) } },
      ]
  var btns = div.insert("span").text(" ");
  btns.selectAll(".btn").data(buttons)
    .enter()
    .insert("button")
    .attr('class', 'btn')
    .on("click", function(d) {return d.f()})
    .text(function(d) {return d.name})
    .each(function() {$(this).button()});
  btns.jq().buttonset();

  function getAlphaSlider() {
    return selection.selectAll('.slider').filter(function (d) {return d.alpha});
  }

  var modes = div.insert("span").text(" ");
  modes.selectAll(".btn").data([
      {name: "Edit", mode: MetroMode.EDIT},
      {name: "View", mode: MetroMode.VIEW}
    ]).enter().insert("span").attr("class", "btn")
      .call(function(span) {
        span.insert("input")
          .attr("type", "radio")
          .attr("name", "debugmode")
          .attr("id", function(_,i) {return "debugmode" + i})
          .property("checked", function(d) {return force.mode() == d.mode})
          .on("change", function(d) {
            force.mode(d.mode);
            if (d.mode != MetroMode.EDIT) {
              getAlphaSlider().jq().slider("value", 0).slider("disable");
            } else {
              getAlphaSlider().jq().slider("value", round(force.alpha)()).slider("enable");
            }
          })
        span.insert("label")
          .attr("for", function(_,i) {return "debugmode" + i})
          .text(function(d) {return d.name});
      });
  modes.jq().buttonset();

  var oldalpha = 0.1;
  function neg(f) {
    return function(v) {
      if (!arguments.length) return -f();
      return f(-v);
    }
  }
  // work around bug https://github.com/mbostock/d3/issues/895
  function ap2(f) {
    return function(v) {
      if (!arguments.length) return f()();
      return f(v);
    }
  }

  function round(f) {
    return function(v) {
      if (!arguments.length) return d3.format(".6f")(f());
      return f(v);
    }
  }
  var sliders =
    [ {name: 'Charge',        min: 0, max: 600, step: 1,       f: neg(force.charge)},
      {name: 'Gravity',       min: 0, max: 0.3, step: 0.01,    f: force.gravity},
      {name: 'Friction',      min: 0, max: 1,   step: 0.01,    f: force.friction},
      {name: 'Link strength', min: 0, max: 1,   step: 0.01,    f: ap2(force.linkStrength),  restart: true},
      {name: 'Link distance', min: 0, max: 80,  step: 1,       f: ap2(force.linkDistance),  restart: true},
      {name: 'Alpha',         min: 0, max: 0.1, step: 0.00001, f: round(force.alpha),       skip: true, alpha: true},
      {name: 'Octoforce'    , min: 0, max: 1,   step: 0.001,   f: force.octoforce,          range: true},
    ];
  selection.insert('table').selectAll('tr').data(sliders)
    .enter()
    .insert('tr')
    .call(function (tr) {
      tr.insert('th')
        .style('text-align', 'right')
        .style('padding-right', '1em')
        .text(function (d) { return d.name });
      var readout = tr.insert('td')
        .attr('class', 'readout')
        .text(function (d) { return d.f() });
      var widgets = tr.insert('td', '.readout')
        .attr('width', '400')
        .insert('div')
        .attr('class', 'slider')
        .each(function (d) {
          $(this).slider({
              min: d.min,
              max: d.max,
              step: d.step,
              value: d.f(),
              values: d.f(), // XXX hack
              range: d.range,
              slide: function(e, ui) {
                d.f(d.range ? ui.values : ui.value);
                readout.text(function (d) {return d.f()});
                if (d.restart) force.start();
                else if (!d.skip) force.resume();
              }});
        });
      force.on("tick.debug", function(e) {
        readout.text(function (d) {return d.f()});
        getAlphaSlider().jq().slider("value", e.alpha);
      });
    });
}
