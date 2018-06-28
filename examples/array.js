function sum(arr) {
  var r = 0;
  for (var i = 0; i < arr["length"]; i = i + 1) {
    r = r + arr[i];
  };
  return r;
};

sum([1,2,3]) // 6
var a = [1,2,3,4];
delete a["3"];
sum(a) // NaN