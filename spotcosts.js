const KEY_FILE = process.argv[2]
const OLD_FILE = process.argv[3]


var aws = require('aws-lib');
var fs = require('fs');
var Firebase = require('firebase');


// plan is to record when instances go up/down..and then correlate that to spot pricing
var keys = fs.readFileSync(KEY_FILE).toString().split("\n");
const AWS_ACCESS_KEY_ID = keys[0].trim();
const AWS_SECRET_ACCESS_KEY = keys[1].trim();

var firebaseLog = new Firebase(keys[2].trim());


function amazonAPI(awsApiCall, region, callback, params) {
  var ec2;
  ec2 = aws.createEC2Client(AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, {
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
    p.set({'state':state, 'node':node, 'data':obj});
}

function processInstances(err, data) {
    var out = {}
    var old;
    var modified = false;
    try{
        old = JSON.parse(fs.readFileSync(OLD_FILE));
    } catch (e) {
        old = {}
    }
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
    if (modified)
        fs.writeFileSync(OLD_FILE, JSON.stringify(out));
//    console.log(err)
//    console.log(JSON.stringify(data))
}

//processInstances(undefined, JSON.parse(fs.readFileSync("instances.json")))
function loop() {
    setTimeout(loop, 60000);
    console.log("pinging aws");
    amazonAPI('DescribeInstances', 'us-west-2', processInstances);
}
loop();
//amazonAPI('DescribeSpotPriceHistory', 'us-west-2', processInstances, {ProductDescription: 'Linux/UNIX'});
