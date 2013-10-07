// http://hg.mozilla.org/build/cloud-tools/file/487b87e5ad16/aws/configs
// http://builddata.pub.build.mozilla.org/buildjson/
// http://hg.mozilla.org/build/buildapi/file/358a04471ef1/buildapi/scripts/reporter.py
var fs = require('fs');
var builds = JSON.parse(fs.readFileSync(process.argv[2]))
var ec2_regexp = new RegExp("-ec2-[0-9]+$");

function parseBuildConfigs(dir) {
  var build_config_files = fs.readdirSync(dir);
  var build_configs = {}
  for (var i = 0;i < build_config_files.length;i++) {
    var f = build_config_files[i];
    var info = JSON.parse(fs.readFileSync(dir + "/" + f));
    var east_coast = info['us-east-1']
    var storage = east_coast.device_map['/dev/sda1'].size
    build_configs[f] = [east_coast.instance_type, storage];
  }
  return build_configs;
}

function BuildCollection() {
  this._builds = []
}

BuildCollection.prototype.add = function (build) {
  var p = build.properties;
  p.duration = b.endtime - b.starttime;
  this._builds.push(p)
}

BuildCollection.prototype.duration = function() {
  var duration = 0;
  for (var i = 0;i < this._builds.length;i++) {
    duration += this._builds[i].duration;
  }
  return duration;
}

BuildCollection.prototype.price = function() {
  var price = 0;
  for (var i = 0;i < this._builds.length;i++) {
    var b = this._builds[i]
    var slavename = b.slavename
    if (slavename) {
      var nodeType = slavename.replace(ec2_regexp, "")
      var awsNode = build_configs[nodeType]
      if (awsNode) {
        awsNode = awsNode[0]
        var pricePerHour = prices[awsNode][0] * 0.93 +  prices[awsNode][1] * 0.07 // based on convo
        price += b.duration / 60 / 60 * pricePerHour
      }
    }
  }
  return price;
}

// hardcoded[price, reserved_price] list from http://calculator.s3.amazonaws.com/calc5.html 
var prices = {'m3.xlarge': [0.500, 0.187], 'm1.xlarge':[ 0.480, 0.170], 'm1.large':[0.240, 0.085 ], 'm1.medium':[0.120, 0.043]};

var build_configs = parseBuildConfigs(process.argv[3])
var max = 0;
var sum = 0;
var jobs = {};
var counter=1;
for(var i = 0;i < builds.builds.length;i++) {
  var b = builds.builds[i];
  //var price = 0;
  var builduid = b.properties.builduid;
  if (!builduid)
    builduid = "nouid" + counter++
 
  var dest = jobs[builduid]
  if (!dest)
    jobs[builduid] = dest = new BuildCollection();
  dest.add(b)
}

for (var builduid in jobs) {
  var j = jobs[builduid]
  var duration = j.duration(j);
  if (!max || duration > max)
    max = j
}

console.log([max.price(), max.duration()/60/60, max._builds[0].builduid, max._builds[0].comments])
