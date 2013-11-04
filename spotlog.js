const FIREBASE = 'https://ec2-dev-activity.firebaseio.com/'
var firebase = new Firebase(FIREBASE);

function human_interval(diff_ms) {
  var diff_s = diff_ms/1000
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


function time_ago(timestamp) {
  return human_interval(new Date() - timestamp)
}

function ms_to_hours(diff) {
  return diff/1000/60/60;
}

function hours_to_ms(hours) {
  return hours * 60 * 60 * 1000;
}

function calcSpotCost(launchTime, endTime, prices, roundHoursUp) {
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

  function cost(launchTime, endTime, costBegin, costEnd) {
    var costStamp = keys[costBegin]
    var hourlyPrice = prices[costStamp];

    if (costBegin == costEnd)
      return ms_to_hours(endTime - launchTime) * hourlyPrice;
    
    var nextTime = Math.min(keys[costBegin + 1], endTime)
    // node started before we got pricing data..fake the beginning of data

    if (launchTime < costStamp) {
      //console.log("estimate:"+launchTime + " to " + costStamp + "("+time_ago(costStamp - launchTime)+")"+" = " + hourlyPrice)
      return ms_to_hours(costStamp - launchTime) * hourlyPrice + cost(costStamp, endTime, costBegin, costEnd);
    }
    //console.log(costStamp + " to " + nextTime + "("+time_ago(nextTime - costStamp)+")"+" = " + hourlyPrice)
    return ms_to_hours(nextTime - launchTime) * hourlyPrice + cost(nextTime, endTime, costBegin + 1, costEnd);
  }

  return cost(launchTime, endTime, firstTime, lastTime);
}

function format_price(price) {
  return Math.round(price*100)/100
}

// fb.child("spot").child("us-west-2a").on("value", function(s) {alert(uneval(s.val()))})
function add_cost(launchTime, endTime, instanceType, availabilityZone, stateReason, jqNode) {
  var diff = endTime - launchTime;
  var instanceKey = instanceType.replace('.', '_')
  firebase.child('ondemand').child('us-west-2').child(instanceKey).on('value', function(snapshot) {
    var perHour = snapshot.val();
    var hours = Math.ceil(ms_to_hours(diff));
    jqNode.append($("<span><b> $"+format_price(hours * perHour)+"</b> ("+hours+" hours)</span>"))
  })
  
  firebase.child("spot").child(availabilityZone).child(instanceKey).on('value', function(snapshot) {
    var prices = snapshot.val()
    if (!prices)
      return
    var free_duration = 0;
    var hours = ms_to_hours(endTime - launchTime);
    if (stateReason == "Server.SpotInstanceTermination") {
      var floor_hours = Math.floor(hours)
      free_duration = hours_to_ms(hours - floor_hours);
      hours = floor_hours;
    } else {
      hours = Math.ceil(hours);
    }
    var billingEndTime = launchTime + hours_to_ms(hours)
    var price = calcSpotCost(launchTime, billingEndTime, prices)
    
    jqNode.append("<span><b> s$" + format_price(price) + "</b></span>");
    if (free_duration) {
      price = calcSpotCost(billingEndTime,billingEndTime + free_duration, prices);
      jqNode.append("<span> Amazon donated <b> s$" + price + "</b>("+human_interval(free_duration)+")</span>");  
    }

  })
}
// 

function output(l, show_age, price_filter) {
  // Server.SpotInstanceTermination stateReason
  /*if (!l.timestamp) {
   snapshot.ref().remove();
   return;
   }*/
  var str =  l.data.instanceId + "("+l.data.instanceType+") " + l.state + " " + l.data.keyName;
  var ageStr = show_age ? "<i>" + time_ago(l.timestamp) + "</i>: " : "";
  var node = $("<div>" + ageStr
               + str + "</div>");
  if (!price_filter || l.state.indexOf(price_filter)!=-1) {
    if (l.data.keyName == 'taras')
      console.log(l.data)
    add_cost(new Date(l.data.launchTime)*1, l.timestamp, l.data.instanceType,
             l.data.placement.availabilityZone, l.data.stateReason.code, node);
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
