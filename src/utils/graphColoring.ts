import * as turf from "@turf/turf";
const brewerColors = [
  "#7F3C8D",
  "#11A579",
  "#3969AC",
  "#F2B701",
  "#E73F74",
  "#80BA5A",
  "#E68310",
  "#008695",
  "#CF1C90",
  "#f97b72",
  "#4b4b8f",
  "#A5AA99",
];

const getColorFromNeighbours = (neighbourColours) => {
  const unused = brewerColors.filter(
    (colour) => !neighbourColours.includes(colour)
  );
  return unused[Math.floor(Math.random() * unused.length)];
};

export function calculateGraphColouring(routes) {
  let adjacency = Object.fromEntries(routes.map((route) => [route.slug, []]));
  const colouring = Object.fromEntries(
    routes.map((route) => [route.slug, undefined])
  );
  const colourCount = Object.fromEntries(
    brewerColors.map((color) => [color, 0])
  );
  routes.forEach((focusRoute, index) => {
    const bufferedLine = turf.buffer(focusRoute.geojson, 3, {
      units: "kilometers",
    });
    routes.slice(index + 1).forEach((comparisonRoute) => {
      const intersect = turf.booleanIntersects(
        bufferedLine,
        comparisonRoute.geojson
      );
      if (intersect) {
        adjacency[focusRoute.slug].push(comparisonRoute.slug);
        adjacency[comparisonRoute.slug].push(focusRoute.slug);
      }
    });
  });

  Object.entries(adjacency).forEach(([node, neighbours]) => {
    const used_neighbour_colours = neighbours.map(
      (neighbour) => colouring[neighbour]
    );
    colouring[node] = getColorFromNeighbours(used_neighbour_colours);
  });
  return colouring;
}

let _cached = null;
export function getGraphColouring(routes) {
  if (!_cached) {
    _cached = calculateGraphColouring(routes);
  }
  return _cached;
}
