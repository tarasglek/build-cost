aws = require('aws-lib');
fs = require('fs');
async = require('async');

var keys = fs.readFileSync(process.argv[2]).toString().split("\r\n");

const AWS_ACCESS_KEY_ID = keys[0];
const AWS_SECRET_ACCESS_KEY = keys[1];

getData = function(region, callback) {
  var ec2;
  console.log('starting ' + region);
  ec2 = aws.createEC2Client(AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, {
    host: 'ec2.' + region + '.amazonaws.com',
    version: '2012-05-01'
  });
  return ec2.call("DescribeSpotPriceHistory", {
    ProductDescription: 'Linux/UNIX'
  }, function(err, data) {
//    return async.map(data.spotPriceHistorySet.item, buildItem, function(err, results) {
    console.log('finished ' + region);
    console.log(JSON.stringify(data.spotPriceHistorySet));
  //  });
  });
};

async.map(['us-east-1', 'us-west-1', 'us-west-2'], getData, function(err, results) {
  var code;
  console.log('finished ' + results);
  return process.exit(code = 0);
});
