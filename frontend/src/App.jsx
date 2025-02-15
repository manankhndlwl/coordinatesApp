import React, { useState, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Popup,
  useMapEvents,
  Polygon,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import axios from "axios";

const PolygonDrawing = ({ onPolygonComplete }) => {
  const [positions, setPositions] = useState([]);

  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      setPositions([...positions, [lat, lng]]);
    },
    dblclick() {
      if (positions.length >= 3) {
        onPolygonComplete(positions);
        setPositions([]); // Reset after saving
      }
    },
  });

  return positions.length > 0 ? (
    <Polygon positions={positions} color="red" />
  ) : null;
};

const App = () => {
  const [position, setPosition] = useState(null); // User's current location
  const [destination, setDestination] = useState(null); // Selected destination
  const [route, setRoute] = useState(null); // Route data
  const [eta, setEta] = useState(null); // Estimated travel time
  const [searchQuery, setSearchQuery] = useState(""); // Search input
  const [searchResults, setSearchResults] = useState([]); // Search results
  const [lastKnownPosition, setLastKnownPosition] = useState(null);
  const [polygons, setPolygons] = useState([]);

  // Get user's real-time location
  useEffect(() => {
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (location) => {
          const newPosition = [
            location.coords.latitude,
            location.coords.longitude,
          ];
          setPosition(newPosition);
          setLastKnownPosition([
            location.coords.latitude,
            location.coords.longitude,
          ]);
        },
        (error) => console.error("Error fetching location:", error),
        { enableHighAccuracy: true }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  // Save polygon to MongoDB
  const handlePolygonComplete = async (polygon) => {
    console.log("🚀 ~ handlePolygonComplete ~ polygon:", polygon);
    try {
      await axios.post(
        "https://coordinatesapp-wtwi.onrender.com/api/polygons",
        {
          coordinates: polygon,
        }
      );
      setPolygons([...polygons, { coordinates: polygon }]); // Update state
    } catch (error) {
      console.error("Error saving polygon:", error);
    }
  };

  // Fetch polygons from MongoDB
  useEffect(() => {
    axios
      .get("https://coordinatesapp-wtwi.onrender.com/api/polygons")
      .then((response) => setPolygons(response.data))
      .catch((error) => console.error("Error fetching polygons:", error));
  }, []);

  // Function to calculate distance between two coordinates (Haversine Formula)
  const getDistance = (coord1, coord2) => {
    const R = 6371e3; // Earth radius in meters
    const [lat1, lon1] = coord1;
    const [lat2, lon2] = coord2;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  };

  // Fetch route from OpenRouteService API
  const getRoute = async (start, end) => {
    try {
      const response = await axios.post(
        "https://coordinatesapp-wtwi.onrender.com/api/getRoute",
        {
          start,
          end,
        }
      );
      console.log("🚀 ~ getRoute ~ response:", response);
      const coordinates = response.data.features[0].geometry.coordinates.map(
        (coord) => [coord[1], coord[0]]
      );
      console.log("🚀 ~ getRoute ~ coordinates:", coordinates);

      setRoute(coordinates);
      setEta(
        Math.ceil(response.data.features[0].properties?.summary.duration / 60)
      ); // Convert seconds to minutes
    } catch (error) {
      console.error("Error fetching route:", error);
    }
  };

  // Search places using OpenStreetMap Nominatim API
  const searchLocation = async () => {
    if (!searchQuery) return;

    try {
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/search?format=json&q=${searchQuery}`
      );
      setSearchResults(response.data);
    } catch (error) {
      console.error("Error fetching search results:", error);
    }
  };

  // Handle location selection from search results
  const handleLocationSelect = (lat, lon) => {
    setDestination([lat, lon]);
    setSearchResults([]); // Clear search results
    if (position) {
      getRoute(position, [lat, lon]); // Fetch route from current location to selected place
    }
  };

  // Periodically check location and update route if moved significantly
  useEffect(() => {
    if (!destination) return;

    const interval = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (location) => {
          const newPos = [location.coords.latitude, location.coords.longitude];
          setPosition(newPos);

          // Check if user has moved more than 50 meters before making a new API call
          if (
            lastKnownPosition &&
            getDistance(lastKnownPosition, newPos) > 50
          ) {
            fetchRoute(newPos, destination);
            setLastKnownPosition(newPos);
          }
        },
        (error) => {
          console.error("Error fetching location:", error);
        }
      );
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [destination, lastKnownPosition]);

  return (
    <div>
      {/* Search Input Box */}
      <div
        style={{
          position: "absolute",
          top: 10,
          left: 100,
          zIndex: 1000,
          background: "white",
          padding: "10px",
          borderRadius: "5px",
        }}
      >
        <input
          type="text"
          placeholder="Search for a place..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && searchLocation()}
          style={{ padding: "5px", width: "200px" }}
        />
        <button
          onClick={searchLocation}
          style={{ marginLeft: "5px", padding: "5px" }}
        >
          Search
        </button>

        {/* Display Search Results */}
        {searchResults.length > 0 && (
          <div
            style={{
              background: "#fff",
              marginTop: "5px",
              padding: "5px",
              borderRadius: "5px",
            }}
          >
            {searchResults.map((result, index) => (
              <div
                key={index}
                style={{
                  cursor: "pointer",
                  padding: "5px",
                  borderBottom: "1px solid #ddd",
                }}
                onClick={() => handleLocationSelect(result.lat, result.lon)}
              >
                {result.display_name}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Map Component */}
      <MapContainer
        center={position || [28.6139, 77.209]}
        zoom={13}
        style={{ height: "100vh", width: "100%" }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {/* User's Current Location */}
        {position && (
          <Marker position={position}>
            <Popup>Your Current Location</Popup>
          </Marker>
        )}

        {/* Destination Marker */}
        {destination && (
          <Marker position={destination}>
            <Popup>Destination</Popup>
          </Marker>
        )}

        {/* Route Polyline */}
        {route && <Polyline positions={route} color="blue" />}

        {/* Estimated Travel Time Display */}
        {eta && (
          <div
            style={{
              position: "absolute",
              top: 10,
              left: 400,
              background: "white",
              padding: "5px",
              borderRadius: "5px",
              zIndex: 1000,
            }}
          >
            Estimated Time: {eta} min
          </div>
        )}

        {/* Draw polygons from MongoDB */}
        {polygons.map((poly, idx) => (
          <Polygon key={idx} positions={poly.coordinates} color="blue" />
        ))}

        {/* Draw new polygon by clicking */}
        <PolygonDrawing onPolygonComplete={handlePolygonComplete} />
      </MapContainer>
    </div>
  );
};

export default App;
