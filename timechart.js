/*
g = new Dygraph(
  document.getElementById("div_g"),
  [], {
    rollPeriod: 7,
    errorBars: true
  }
);*/

const IO_WAIT = -1
const START = 0;
const DURATION = 1;
const WAIT_KIND = 2;

function convert(cpu) {
  var dest = [];
  for (var y =0;y<cpu.samples.length;y+=3) {
    var s = cpu.samples;
    var cpu_num = s[y+0]
    //convert negative states into error bars...ignore cpu #
    var wait_kind = cpu_num;
    var out = [s[y+1], s[y+2], wait_kind]
    if (wait_kind == -1)
      dest.push(out)
  }
  function compare(a, b) {
    return a[0] - b[0];
  }
  var dedup = []
  dest.sort(compare)
  for (var i = 0;i < dest.length;i++) {
    var current = dest[i]
    if (dedup.length) {
      var last = dedup[dedup.length - 1];
      var skip = false;
      if (last[0] == current[0]) {
        last[1] = Math.max(last[1], current[1]);
        skip = true
        // merge adjacent entries
      } else if (last[0] + last[1] >= current[0]) {
        last[1] += current[0] + current[1] - (last[0] + last[1])
        skip = true
      }
      if (skip) {
        if (current[2] == IO_WAIT)
          last[2] = IO_WAIT
        continue
      }
    }
    dedup.push(current)
  }
  return dedup;
}

function main(data) {
  var lines = data.split('\n')
  var converted = []
  var axis_labels = ['ticks']
  for (var i=0;i<lines.length;i++) {
    var l = lines[i]
    if (!l.length) continue;
    var o = JSON.parse(l)
    if (o.process && o.samples.length) {
      var c = convert(o, i)
      var n = {id:converted.length, name:(o.process + "/"+o.pid), samples:c, i:0}
      if (!c.length)
        continue
      converted.push(n)
      //console.log(uneval(n))
      axis_labels.push(n.name)
    }
  }
  lines = undefined
  var graph = []

  while(true) {
    var lowest_start_time = undefined
    // x axis + number of processes we graph
    var dest = new Array(converted.length + 1);
    // first pass: figure out next timestamp
    for (var y=0;y<converted.length;y++) {
      var c = converted[y]
      if (c.i >= c.samples.length) {
        // remove item from input array once we are done with it
        converted.splice(y, 1);
        y--;
        continue
      }
      var current_time = c.samples[c.i][0]
      if (lowest_start_time == undefined)
        lowest_start_time = current_time
      else
        lowest_start_time = Math.min(lowest_start_time, current_time);
    }
    if (lowest_start_time == undefined)
      break;

    dest[0] = lowest_start_time; // set x-axis
    for (var y=0;y<converted.length;y++) {
      var c = converted[y]
      var sv = c.samples[c.i]
      start_time = sv[0];
      if (lowest_start_time < start_time) {
        continue
      }
      // http://dygraphs.com/tests/custom-circles.html

      var wait_time = sv[1];
      var wait_kind = sv[2];
      dest[c.id + 1] = c.id//[y*5,wait_kind]
      if (start_time == lowest_start_time) {
        if (wait_time) {
          sv[1]--;
          sv[0]++;
        } else {
          c.i++;
        }
      }
    }
    graph.push(dest)
  }

  g = new Dygraph(
    document.getElementById("div_g"),
    graph, {
      //errorBars:true,
      labels: axis_labels,
      drawPoints : true,
      drawPointCallback:Dygraph.Circles.TRIANGLE,
 pointSize : 5,
            highlightCircleSize: 8,
//      drawPointCallback: frown
    })
/*
  var annotations = [];
  for (var y=0;y<converted.length;y++) {
    var c = converted[y]
    annotations.push({
                       series: n.name,
                       x: ""+c.samples[0][0]-first_lowest_start_time,
                       shortText: n.name,
                       text: 'Stock Market Crash '})
  }
  console.log(uneval(annotations))
  g.setAnnotations(annotations)*/

}

$.ajax({url: "timechart.json", dataType:"text"}).done(main).fail(function(jqXHR, textStatus, errorThrown) {
            alert([textStatus, errorThrown]);
    });


