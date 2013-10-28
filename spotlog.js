const FIREBASE = 'https://ec2-dev-activity.firebaseio.com/'
var awsPrices = new Firebase(FIREBASE + 'ondemand/us-west-2');

function age(timestamp) {
  var diff_s = (new Date() - timestamp)/1000
  if (diff_s < 60)
    return Math.round(diff_s) + " seconds"
  var diff_m = diff_s / 60;
  if (diff_m < 120)
    return Math.round(diff_m) + " minutes"
  var diff_h = diff_m / 60;
  if (diff_h < 24)
    return Math.round(diff_h) + " hours"
  var diff_d = diff_h / 24;
  return Math.round(diff_d) + " days"
}

function output(l, show_age, price_filter) {
  /*if (!l.timestamp) {
   snapshot.ref().remove();
   return;
   }*/
  var str =  l.data.instanceId + "("+l.data.instanceType+") " + l.state + " " + l.data.keyName;
  var ageStr = show_age ? "<i>" + age(l.timestamp) + "</i>: " : "";
  var node = $("<div>" + ageStr
               + str + "</div>");
  if (!price_filter || l.state.indexOf(price_filter)!=-1) {
    var diff = l.timestamp - new Date(l.data.launchTime)
    var type = l.data.instanceType
    awsPrices.child(type.replace('.', '_')).on('value', function(snapshot) {
      var perHour = snapshot.val();
      var hours = Math.ceil(diff/1000/60/60);
      node.append($("<span><b> $"+(hours * perHour)+"</b> ("+hours+" hours)</span>"))
    })
  }
  //  console.log(l)
  document.title = l.state + " " + l.data.instanceId;
  $( ".container" ).prepend( node );
}

function pricelog () {
  var listRef = new Firebase(FIREBASE + 'log');
  listRef.on('child_added', function(snapshot) {
    output(snapshot.val(), true, "->terminated");
  });
}

function pricetop () {
  $( ".container" ).empty();
  var firebaseOld = new Firebase(FIREBASE + "old");
  firebaseOld.on('value', function (snapshot) {
    var old = snapshot.val();
    var running = []
    for (var instanceId in old) {
      var o = old[instanceId];
      if (o.instanceState.name != "running")
        continue;
      running.push(o);
      o.launchTime = new Date(o.launchTime)
    }
    running.sort(function (a, b) {return b.launchTime - a.launchTime});
    var now = Date.now()
    running.forEach(function (o) {
      output({'timestamp':now, 'data':o, 'state':'running'});
    })
  })
}
