const FIREBASE = 'https://ec2-dev-activity.firebaseio.com/'
var firebase = new Firebase(FIREBASE);

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

function calcSpotCost(launchTime, endTime, prices) {
  var keys = Object.keys(prices)
  keys.sort(function(a, b) {return a - b})
  var firstTime = null;
  var lastTime = null;
  for(var i = 0;i<keys.length;i++) {
    var time = keys[i];
    if (firstTime == null || launchTime > time)
      lastTime = firstTime = i //might as well initialize last time here)
    else if (endTime > time)
      lastTime = i
  }

  function to_hours(diff) {
    return diff/1000/60/60;
  }

  function cost(launchTime, endTime, costBegin, costEnd) {
    var costStamp = keys[costBegin]
    var hourlyPrice = prices[costStamp];

    if (costBegin == costEnd)
      return to_hours(endTime - launchTime) * hourlyPrice;
    
    var nextTime = Math.min(keys[costBegin + 1], endTime)
    // node started before we got pricing data..fake the beginning of data

    if (launchTime < costStamp) {
      //console.log("estimate:"+launchTime + " to " + costStamp + "("+age(costStamp - launchTime)+")"+" = " + hourlyPrice)
      return to_hours(costStamp - launchTime) * hourlyPrice + cost(costStamp, endTime, costBegin, costEnd);
    }
    //console.log(costStamp + " to " + nextTime + "("+age(nextTime - costStamp)+")"+" = " + hourlyPrice)
    return to_hours(nextTime - launchTime) * hourlyPrice + cost(nextTime, endTime, costBegin + 1, costEnd);
  }

  return cost(launchTime, endTime, firstTime, lastTime);
}

function format_price(price) {
  return Math.round(price*100)/100
}

// fb.child("spot").child("us-west-2a").on("value", function(s) {alert(uneval(s.val()))})
function add_cost(launchTime, endTime, instanceType, availabilityZone, jqNode) {
  var diff = endTime - launchTime;
  var instanceKey = instanceType.replace('.', '_')
  firebase.child('ondemand').child('us-west-2').child(instanceKey).on('value', function(snapshot) {
    var perHour = snapshot.val();
    var hours = Math.ceil(diff/1000/60/60);
    jqNode.append($("<span><b> $"+format_price(hours * perHour)+"</b> ("+hours+" hours)</span>"))
  })
  
  firebase.child("spot").child(availabilityZone).child(instanceKey).on('value', function(snapshot) {
    var prices = snapshot.val()
    var price = calcSpotCost(launchTime, endTime, prices)
    jqNode.append("<span><b> s$" + format_price(price) + "</b></span>");
  })
}


function output(l, show_age, price_filter) {
  // Server.SpotInstanceTermination stateReason
  /*if (!l.timestamp) {
   snapshot.ref().remove();
   return;
   }*/
  var str =  l.data.instanceId + "("+l.data.instanceType+") " + l.state + " " + l.data.keyName;
  var ageStr = show_age ? "<i>" + age(l.timestamp) + "</i>: " : "";
  var node = $("<div>" + ageStr
               + str + "</div>");
  if (!price_filter || l.state.indexOf(price_filter)!=-1) {
    add_cost(new Date(l.data.launchTime), l.timestamp, l.data.instanceType, l.data.placement.availabilityZone, node);
  }
  //console.log(l)
  // trigger firefox apptab notification
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
