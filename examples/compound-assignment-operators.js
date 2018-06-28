let val = 0;

function inc1() {
 val++;
 console.log(val);
}

function inc2() {
 val += inc1();
 console.log(val);
}

inc2();