function foo() {
  if (true) { var x = 10; }
  return x;
}

foo(); // 10


function bar(x) {
  return function() {
    var x = x;
    return x;
  }
}

bar(200)(); //undefined