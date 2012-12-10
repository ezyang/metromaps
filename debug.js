function debugForce(force, selection) {

  var divr = selection.insert('div');

  var divm = divr.insert('span');
  var div = divr.insert('span');

  // us specific
  var modes = divm.insert("span").text(" ");
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
          .on("change", function(d) { force.mode(d.mode); div.style('visibility', d.mode == MetroMode.EDIT ? 'visible' : 'hidden'); })
        span.insert("label")
          .attr("for", function(_,i) {return "debugmode" + i})
          .text(function(d) {return d.name});
      });
  modes.jq().buttonset();

  var labeltog = div.insert("input")
    .attr("type", "checkbox")
    .attr("id", "debuglabeltog")
    .on("change", function() {
      if (this.checked) {
        d3.selectAll(".metrotext").style("display", "inherit");
      } else {
        d3.selectAll(".metrotext").style("display", "none");
      }
    })
    .property("checked", true);
  div.insert("label").attr("for", "debuglabeltog").text("Labels");
  labeltog.jq().button();

  var play = div.insert("span").text(" ").insert("input")
    .attr("type", "checkbox")
    .attr("id", "debugplay")
    .property("checked", !force.paused())
    .on("change", function() { setplay(this.checked); });
  function setplay(v) {
    play.property("checked", v); // XXX annoying
    force.paused(!v);
    play.jq().button({ icons: { primary: !play.property("checked") ? "ui-icon-play" : "ui-icon-pause" }, text: false });
    play.jq().button("refresh");
  }
  div.insert("label").attr("for", "debugplay").text("Run");
  play.jq().button({ icons: { primary: "ui-icon-pause" }, text: false });
  var buttons =
      [ {name: "Restart",     f: function() { setplay(true);
                                              force.start(); } },
        {name: "Fix all", f: function() { force.nodes().forEach(function(n) {n.fixed = 1;}) } },
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

  var linear =
      [ {name: "Octilinear", line: octilinear },
        {name: "Hexilinear", line: hexilinear },
      ]
  var linear_btns = div.insert("span").text(" ");
  linear_btns.selectAll(".btn").data(linear)
    .enter()
    .insert("span")
    .attr("class", "btn")
    .call(function(span) {
      span.insert("input")
        .attr("type", "radio")
        .attr("name", "linear")
        .attr("id", function(_,i) {return "linear" + i})
        .property("checked", function(d) {return d.name == "Octilinear"})
        .on("change", function(d) {force.directions(d.line); force.start();});
      span.insert("label")
        .attr("for", function(_,i) {return "linear" + i})
        .text(function(d) {return d.name});
    });
  linear_btns.jq().buttonset();

  function getAlphaSlider() {
    return selection.selectAll('.slider').filter(function (d) {return d.alpha});
  }

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
      {name: 'Link distance', min: 0, max: 200,  step: 1,       f: ap2(force.linkDistance),  restart: true},
      {name: 'Alpha',         min: 0, max: 0.1, step: 0.00001, f: round(force.alpha),       skip: true, alpha: true},
      {name: 'Octoforce'    , min: 0, max: 1,   step: 0.001,   f: force.octoforce,          range: true},
      {name: 'Monoforce'    , min: 0, max: 1,   step: 0.001,   f: force.monoforce,          range: true},
      {name: 'Timeforce'    , min: 0, max: 1,   step: 0.001,   f: force.timeforce,          range: true},
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
              value: d.range ? undefined : d.f(),
              values: d.range ? d.f() : undefined,
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
  function updateSliders() {
    return selection.selectAll('.slider').each(function(d) {$(this).slider({value: d.range ? undefined : d.f(), values: d.range ? d.f() : undefined})});
  }

  var buttons2 =
      [ {name: "Dump", f: function() { $("#jsonbox").val(JSON.stringify(force.state())); } },
        {name: "Load", f: function() { force.state(JSON.parse($("#jsonbox").val())); force(); force.stop(); updateSliders(); }},
        // US specific
        // XXX kind of user unfriendly at the moment
        {name: "Copy to LocalStorage", f: function() {  var json = JSON.stringify(force.state())
                                            $("#jsonbox").val(JSON.stringify(force.state()));
                                            localStorage.setItem("state", json)
                                         }},
        {name: "Delete from LocalStorage", f: function() { if (confirm("Are you sure you want to delete?")) { localStorage.setItem("state", null); } }},
      ];
  var btns2 = selection.insert("div");
  btns2.selectAll(".btn").data(buttons2)
    .enter()
    .insert("button")
    .attr('class', 'btn')
    .on("click", function(d) {return d.f()})
    .text(function(d) {return d.name})
    .each(function() {$(this).button()});
  btns2.jq().buttonset();

  selection.insert('textarea').style("font-size", "8px").attr('rows', '10').attr('cols', '120').attr("id", "jsonbox").property("value", localStorage.getItem("state"));
}
