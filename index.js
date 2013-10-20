const CONFIG_FILE = "config.json"

var aws = require('aws-lib');
var fs = require('fs');
var Firebase = require('firebase');

// plan is to record when instances go up/down..and then correlate that to spot pricing
var config = JSON.parse(fs.readFileSync(CONFIG_FILE))

var firebaseLog = null;
var firebaseOld = null;
var old = {}

function amazonAPI(awsApiCall, region, callback, params) {
  var ec2;
  ec2 = aws.createEC2Client(config.accessKeyId, config.secretAccessKey, {
    host: 'ec2.' + region + '.amazonaws.com'
  });
//jq '.item[] as $o| [$o.instanceType, $o.spotPrice, $o.timestamp, $o.availabilityZone]' -c  < ret.json
// jq '.[].instancesSet.item as $i | [$i.instanceType,$i.placement,$i.instanceState,$i.instanceLifecycle]'
  return ec2.call(awsApiCall, params, function(err, data) {
      for (var i in data) {
          var ret = data[i]
          if (typeof ret == 'object' && 'item' in ret) {
              callback(err, ret.item);
              return;
          }
      }
  });
};

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

function pretty(instance) {
        return [instance.instanceType,instance.placement.availabilityZone,instance.instanceState.name,instance.instanceLifecycle, instance.instanceId, age(new Date(instance.launchTime))]
}

function log_activity(state, node, obj) {
    console.log(state + " " + node + " " + pretty(obj))
    var p = firebaseLog.push();
    p.set({'state':state, 'node':node, 'data':obj, 'timestamp':Date.now()});
}

function processInstances(err, data) {
    if (err) {
        console.log("aws call failed");
        return;
    }

    if (!firebaseLog)
        firebaseLog = new Firebase(config.firebase + "/log");

    var out = {}
    var modified = false;

    function iterate2(x) {
        // amazon sticks groups together into a subarray
        if (x.constructor == Array) {
            x.forEach(iterate2)
            return;
        }
        if (!x.placement) {
            console.log(x)
            return;
            }
        out[x.instanceId] = x;
    }
    function iterate(x) {
        iterate2(x.instancesSet.item)
    }
    data.forEach(iterate);

    for (var old_id in old) {
        var o = old[old_id];
        if (!(old_id in out)) {
            log_activity(o.instanceState.name + "->disappeared", old_id, o)
            modified = true;
        }
    }

    for (var new_id in out) {
        var n = out[new_id];
        var o = old[new_id];
        if (!(new_id in old)) {
            log_activity("appeared", new_id, n)
            modified = true;
        } else if (n.instanceState.name != o.instanceState.name) {
            log_activity(o.instanceState.name + "->" + n.instanceState.name, new_id, n)
            modified = true;
        }
    }
    if (modified) {
        firebaseOld.set(out)
    }
}

var prices = {}

function logSpotPrice(entry) {
    var now = Date.now();
    console.log(new Date(), entry.key, entry.spotPrice)
    var f = entry.firebase;
    if (!f) {
        var url = config.firebase + "/spot/" + entry.key.replace('.', '_')
        entry.firebase = f = new Firebase(url);
    }
    f.child(now).set(entry.spotPrice);
}

function processSpotPrices(err, data) {
    for (var entry in data) {
        var p = data[entry]
        p.spotPrice *= 1;
        var key = p.availabilityZone + "/" + p.instanceType
        var old = prices[key]

        if (!old) {
            prices[key] = old = {'spotPrice': p.spotPrice,
                                 'timestamp': p.timestamp,
                                 'key': key
                                };
            logSpotPrice(old);
            continue;
        }
        // dont record info if it didn't change
        if (p.timestamp <= old.timestamp || p.spotPrice == old.spotPrice)
            continue;
        old.spotPrice = p.spotPrice;
        old.timestamp = p.timestamp;
        logSpotPrice(old)
    }
}

//processInstances(undefined, JSON.parse(fs.readFileSync("instances.json")))
function loop(api_func, callback, params) {
    setTimeout(function() {loop(api_func, callback, params)}, 60000);
    amazonAPI(api_func, 'us-west-2', callback, params);
}

//load the old value and start monitoring
function main() {
    firebaseOld = new Firebase(config.firebase + "/old");
    firebaseOld.on('value', function (snapshot) {
        old = snapshot.val();
        loop('DescribeInstances', processInstances);
    })
    loop('DescribeSpotPriceHistory', processSpotPrices, {ProductDescription: 'Linux/UNIX'});

}

main();
