aws = require('aws-lib');
fs = require('fs');
async = require('async');

var keys = fs.readFileSync(process.argv[2]).toString().split("\n");

const AWS_ACCESS_KEY_ID = keys[0].trim();
const AWS_SECRET_ACCESS_KEY = keys[1].trim();

getSpotPrices = function(region, callback) {
  var ec2;
  ec2 = aws.createEC2Client(AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, {
    host: 'ec2.' + region + '.amazonaws.com'
 
  });
  return ec2.call("DescribeSpotPriceHistory", {
    ProductDescription: 'Linux/UNIX'
  }, function(err, data) {
//jq '.item[] as $o| [$o.instanceType, $o.spotPrice, $o.timestamp, $o.availabilityZone]' -c  < ret.json
//    return async.map(data.spotPriceHistorySet.item, buildItem, function(err, results) {
    //console.log('finished ' + region);
    console.log(JSON.stringify(data.spotPriceHistorySet.item));
  //  });
  });
};

listInstances = function(region, callback) {
  var ec2;
  ec2 = aws.createEC2Client(AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, {
    host: 'ec2.' + region + '.amazonaws.com'
 
  });
// jq '.[].instancesSet.item as $i | [$i.instanceType,$i.placement,$i.instanceState,$i.instanceLifecycle]'
  return ec2.call("DescribeInstances", {
  }, function(err, data) {
//    return async.map(data.spotPriceHistorySet.item, buildItem, function(err, results) {
    //console.log('finished ' + region);
    console.log(JSON.stringify(data.reservationSet.item));
  //  });
  });
};

listInstances('us-west-2');

