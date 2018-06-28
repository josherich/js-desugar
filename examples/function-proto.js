function Human(father, mother) {
  var gene = father("ATCG") + mother("ATCG");
  return embryo(gene);
}


var man = new Human(father, mother);