/**
 * Pausable force layouts.
 *
 * When debugging force-directed layouts, it's useful to be able to pause
 * the layout algorithm, make some modifications, and then start it up
 * again.  Why might you not want to use stop/resume/start manually?
 * Well, you might have some code which tweaks a parameter in the layout
 * and then invokes stop/resume/start; however, if the layout is paused,
 * you'd really like that change to be buffered for until the layout is
 * unpaused.
 *
 * This adds a new accessor, 'paused', which allows you to pause and
 * unpause the layout.  Otherwise, the interface is the same.
 *
 * Note for draggers: if you have installed a drag handler, strange
 * things may happen since the (x,y) coordinates were not updated.
 * See https://github.com/mbostock/d3/issues/919
 *
 * Usage:
 *
 *    var force = d3.layout.force();
 *    d3_layout_force_pausable(force);
 *
 * (Alas, force does not support 'call').
 */

function d3_layout_force_pausable(force) {
  var paused = false,
      pendingAlpha,
      pendingStart;

  force.paused = function(v) {
    if (!arguments.length) return paused;
    if (v != paused) { // only trigger on change
      if (v) {
        pendingAlpha = force.alpha(); // careful about updating me
        pendingStart = false;
        force.stop();
        paused = true;
      } else {
        paused = false; // must be done before
        if (pendingStart) force.start();
        force.alpha(pendingAlpha);
      }
    }
    return force;
  }

  function replace(orig, h) {
    return function() {
      if (paused) {
        return h.apply(this, arguments);
      } else {
        return orig.apply(this, arguments);
      }
    }
  }

  force.alpha = replace(force.alpha, function(v) {
    if (!arguments.length) return pendingAlpha;
    pendingAlpha = parseFloat(v);
    return force;
  });
  force.start = replace(force.start, function() {
    pendingStart = true;
    pendingAlpha = 0.1;
    return force;
  });

  return force;
}
