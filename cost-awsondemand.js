var fs = require('fs');
const type_translation = {
    'm1.small' : ['stdODI', 'sm'],
    'm1.medium' : ['stdODI', 'med'],
    'm1.large' : ['stdODI', 'lg'],
    'm1.xlarge' : ['stdODI', 'xl'],
    't1.micro' : ['uODI', 'u'],
    'm2.xlarge' : ['hiMemODI', 'xl'],
    'm2.2xlarge' : ['hiMemODI', 'xxl'],
    'm2.4xlarge' : ['hiMemODI', 'xxxxl'],
    'm3.xlarge' : ['secgenstdODI', 'xl'],
    'm3.2xlarge' : ['secgenstdODI', 'xxl'],
    'c1.medium' : ['hiCPUODI', 'med'],
    'c1.xlarge' : ['hiCPUODI', 'xl'],
    'cc1.4xlarge' : ['clusterComputeI', 'xxxxl'],
    'cc2.8xlarge' : ['clusterComputeI', 'xxxxxxxxl'],
    'cr1.8xlarge' : ['clusterHiMemODI', 'xxxxxxxxl'],
    'cg1.4xlarge' : ['clusterGPUI', 'xxxxl'],
    'hi1.4xlarge' : ['hiIoODI', 'xxxxl'],
    'hs1.8xlarge' : ['hiStoreODI', 'xxxxxxxxl']
}

function getMarketingName(nodeType, size) {
    for (var marketingName in type_translation) {
        var details = type_translation[marketingName]
        if (nodeType == details[0] && size == details[1]) {
            return marketingName
        }
    }
    throw new Error("Can't find Amazon marketing name for " + [nodeType, size]);
}

function get_instance_prices(instanceTypes, target_os)  {
    var outPrices = {}
    for (var j = 0;j < instanceTypes.length;j++) {
        var i = instanceTypes[j]
        for (var y = 0;y < i.sizes.length;y++) {
            var s = i.sizes[y]
            // iterate over win/linux 2item array
            for (var z = 0; z < s.valueColumns.length;z++) {
                var v = s.valueColumns[z];
                if (v.name == target_os) {
                    var price = v.prices['USD']
                    var marketingName = getMarketingName(i.type, s.size)
                    //console.log(i.type, s.size, price, marketingName)
                    outPrices[marketingName] = price
                    break;
                }
            }
        }
    }
    return outPrices
}

function get_prices(input, target_os, target_region) {
    var outRegions = {}
    for(var i = 0;i < input.config.regions.length;i++) {
        var r = input.config.regions[i];
        if (!target_region || target_region == r.region) {
            outRegions[r.region] = get_instance_prices(r.instanceTypes, target_os)
        }
    }
    return outRegions
}

//console.log(get_prices(JSON.parse(fs.readFileSync("pricing-on-demand-instances.json")), "us-west-2", "linux"))

module.exports = {
    get_prices: get_prices
}
