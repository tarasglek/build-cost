calculator is a simple node script that tallies up hours in build logs and tries to estimate cost.

```
hg clone http://hg.mozilla.org/build/cloud-tools/
mv cloud-tools/aws/configs/ .
wget http://builddata.pub.build.mozilla.org/buildjson/builds-2013-10-28.js.gz
gunzip builds-2013-10-28.js.gz 
node calculator.js  builds-2013-10-28.js  configs
```
