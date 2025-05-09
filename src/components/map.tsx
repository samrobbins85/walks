import { useEffect } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
export default function Map({ geoData }) {
  console.log(geoData);
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
      }
    ).addTo(map);

    const geoJsonLayer = L.geoJSON(geoData, {
      style: {
        color: "red",
        weight: 2,
      },
    }).addTo(map);
    map.fitBounds(geoJsonLayer.getBounds());
    const bounds = geoJsonLayer.getBounds();

    map.setMaxBounds(bounds);
    map.setMinZoom(map.getZoom());
    map.setMaxZoom(16);

    map.setMaxBounds(bounds.pad(0.5));
    return () => {
      map.remove();
    };
  }, []);

  return (
    <div>
      <div id="map" style={{ height: "400px", width: "100%" }}>
        <div className="os-api-branding logo" />
      </div>
    </div>
  );
}
