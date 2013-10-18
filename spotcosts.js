aws = require('aws-lib');
fs = require('fs');

const KEY_FILE = process.argv[2]
const OLD_FILE = process.argv[3]
//plan is to record when instances go up/down..and then correlate that to spot pricing
var keys = fs.readFileSync(KEY_FILE).toString().split("\n");

const AWS_ACCESS_KEY_ID = keys[0].trim();
const AWS_SECRET_ACCESS_KEY = keys[1].trim();

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

function processInstances(err, data) {
    var out = {}
    var old;
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
//        console.log(x)
        out[x.instanceId] = x;
    }
    function iterate(x) {
        iterate2(x.instancesSet.item)
    }
    data.forEach(iterate);

    for (var old_id in old) {
        var o = old[old_id];
        if (!(old_id in out)) {
            console.log("disappeared "+pretty(o))
        }
    }
    for (var new_id in out) {
        var n = out[new_id]
        if (!(new_id in old)) {
            console.log("appeared "+pretty(n))
        } else if (n.instanceState.name != old[new_id].instanceState.name) {
            console.log("state-change "+pretty(n))
        }
    }

    fs.writeFileSync(OLD_FILE, JSON.stringify(out));
//    console.log(err)
//    console.log(JSON.stringify(data))
}

//processInstances(undefined, JSON.parse(fs.readFileSync("instances.json")))
amazonAPI('DescribeInstances', 'us-west-2', processInstances);
//amazonAPI('DescribeSpotPriceHistory', 'us-west-2', processInstances, {ProductDescription: 'Linux/UNIX'});
