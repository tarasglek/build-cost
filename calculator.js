// http://hg.mozilla.org/build/cloud-tools/file/487b87e5ad16/aws/configs
// http://builddata.pub.build.mozilla.org/buildjson/
// http://hg.mozilla.org/build/buildapi/file/358a04471ef1/buildapi/scripts/reporter.py
var fs = require('fs');
var builds = JSON.parse(fs.readFileSync(process.argv[2]))
function parseBuildConfigs(dir) {
  var build_config_files = fs.readdirSync(dir);
  var build_configs = {}
  for (var i = 0;i < build_config_files.length;i++) {
    var f = build_config_files[i];
    var info = JSON.parse(fs.readFileSync(dir + "/" + f));
    build_configs[f] = info['us-east-1'].instance_type;
  }
  return build_configs;
}
// hardcoded list from http://calculator.s3.amazonaws.com/calc5.html 
var prices = {'m3.xlarge': [0.500, 0.187], 'm1.xlarge':[ 0.480, 0.170], 'm1.large':[0.240, 0.085 ], 'm1.medium':[0.120, 0.043]};

var build_configs = parseBuildConfigs(process.argv[3])
var max = 0;
var sum = 0;
var jobs = {};
for(var i = 0;i < builds.builds.length;i++) {
  var b = builds.builds[i];
  var duration = b.endtime - b.starttime
  var price = 0;
  var slavename = b.properties.slavename
  var builduid = b.properties.builduid;
  if (slavename) {
    var nodeType = slavename.replace(new RegExp("-ec2-[0-9]+$"), "")
    var awsNode = build_configs[nodeType]
    if (awsNode) {
      var pricePerHour = prices[awsNode][0]
      price = duration / 60 / 60 * pricePerHour
    }
  }
  sum += price;
  if (builduid in jobs) {
    jobs[builduid].price += price;
    jobs[builduid].duration += duration;
  } else {
    p = b.properties;
    p.price = price;
    p.duration = duration
    jobs[builduid] = p;
  }
  //console.log(duration+ "\t" + nodeType + "\t" + price)  
}

for (var builduid in jobs) {
  var j = jobs[builduid]
  if (!max || j.price > max.price)
    max = j
}

console.log([max.price, max.duration/60/60, sum])
