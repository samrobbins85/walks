import * as turf from "@turf/turf";
const brewerColors = [
  "#1b9e77",
  "#d95f02",
  "#7570b3",
  "#e7298a",
  "#66a61e",
  "#e6ab02",
  "#a6761d",
  "#666666",
];

export function getGraphColouring(routes) {
  let adjacency = Object.fromEntries(routes.map((route) => [route.slug, []]));
  const colouring = Object.fromEntries(
    routes.map((route) => [route.slug, undefined])
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
  adjacency = Object.entries(adjacency).sort(
    ([_aKey, aValue], [_bKey, bValue]) => bValue.length - aValue.length
  );
  adjacency.forEach(([node, neighbours]) => {
    if (neighbours.length === 0) {
      colouring[node] =
        brewerColors[Math.floor(Math.random() * brewerColors.length)];
    } else {
      const used_neighbour_colours = neighbours.map(
        (neighbour) => colouring[neighbour]
      );
      colouring[node] = brewerColors.find(
        (color) => !used_neighbour_colours.includes(color)
      );
    }
  });
  return colouring;
}
