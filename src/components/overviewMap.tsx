import { useEffect } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { shuffle } from "../utils";

function getColor(index, total) {
  const hue = (index / total) * 360;
  return `hsl(${hue}, 50%, 50%)`;
}

export default function OverviewMap({ routes }) {
  console.log(routes);
  useEffect(() => {
    const map = L.map("map");
    L.tileLayer(
      `https://api.os.uk/maps/raster/v1/zxy/Outdoor_3857/{z}/{x}/{y}.png?key=${
        import.meta.env.PUBLIC_OS_MAPS_KEY
      }`,
      {
        attribution:
          "<span>Contains OS data &copy; Crown copyright and database rights YYYY</span>".replace(
            "YYYY",
            new Date().getFullYear().toString()
          ),
        detectRetina: false,
        minNativeZoom: 7,
        minZoom: 6,
        maxZoom: 16,
      }
    ).addTo(map);

    let combinedBounds = L.latLngBounds([]);

    shuffle(routes).forEach((route, index) => {
      const layer = L.geoJSON(route.geojson, {
        style: {
          color: getColor(index, routes.length),
          weight: 3,
        },
        onEachFeature: function (feature, layer) {
          // You can customize the tooltip text here
          const tooltipText = route.title;

          // Bind the tooltip to the layer
          layer.bindTooltip(tooltipText, {
            permanent: false, // Only show on hover
            direction: "auto", // Let Leaflet decide where to position the tooltip
            sticky: true, // Tooltip follows the cursor
          });

          layer.on("click", () => {
            const url = `/${route.slug}`;
            window.location.href = url;
          });
        },
      }).addTo(map);

      combinedBounds.extend(layer.getBounds());
    });
    const northumberlandBounds = L.latLngBounds(
      [54.7054, -2.7612],
      [55.8113, -1.3802]
    );
    map.setMaxBounds(combinedBounds.pad(0.2));
    map.fitBounds(northumberlandBounds);

    return () => {
      map.remove();
    };
  }, []);

  return (
    <div>
      <div
        id="map"
        style={{ height: "600px", width: "100%" }}
        className="rounded-lg"
      >
        <div className="os-api-branding logo" />
      </div>
    </div>
  );
}
