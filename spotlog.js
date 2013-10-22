var listRef = new Firebase('https://ec2-dev-activity.firebaseio.com/log');

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

listRef.on('child_added', function(snapshot) {
    var l = snapshot.val();
    /*if (!l.timestamp) {
        snapshot.ref().remove();
        return;
    }*/
    var node;
    node = $("<div><i>"+age(l.timestamp)+"</i>: "
             + l.data.instanceId + "("+l.data.instanceType+") " + l.state + " " + l.data.keyName + "</div>");
    console.log(l)
    document.title = l.state + " " + l.data.instanceId;
  $( ".container" ).prepend( node );
});
