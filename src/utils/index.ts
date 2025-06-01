export function shuffle(array) {
  let m = array.length,
    i;

  // While there remain elements to shuffle…
  while (m) {
    // Pick a remaining element…
    i = Math.floor(Math.random() * m--);

    // And swap it with the current last element.
    [array[m], array[i]] = [array[i], array[m]];
  }

  return array;
}
