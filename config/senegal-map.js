// Shared listing map: Leaflet (vendored, loaded on demand) over OpenStreetMap tiles.
// Listings only store a city, so markers are placed at city level and grouped by city.
(function () {
  if (window.PencmiMap) return;

  // Approximate city-centre coordinates [latitude, longitude].
  const CITY_COORDINATES = {
    "dakar": [14.6928, -17.4467],
    "guediawaye": [14.7739, -17.3943],
    "keur-massar": [14.7833, -17.3167],
    "pikine": [14.7646, -17.3907],
    "rufisque": [14.7158, -17.2736],
    "diamniadio": [14.7217, -17.1836],
    "bargny": [14.6939, -17.2336],
    "sebikotane": [14.7469, -17.1361],
    "lac-rose": [14.839, -17.234],
    "diourbel": [14.655, -16.2314],
    "bambey": [14.7003, -16.4594],
    "mbacke": [14.7903, -15.9081],
    "touba": [14.85, -15.8833],
    "fatick": [14.339, -16.4111],
    "foundiougne": [14.1333, -16.4667],
    "gossas": [14.4928, -16.0656],
    "sokone": [13.8833, -16.3667],
    "kaffrine": [14.1059, -15.5508],
    "birkilane": [14.1333, -15.75],
    "koungheul": [13.9833, -14.8],
    "malem-hodar": [14.0833, -15.3],
    "kaolack": [14.152, -16.0726],
    "guinguineo": [14.2667, -15.95],
    "nioro-du-rip": [13.75, -15.8],
    "kedougou": [12.5556, -12.1744],
    "salemata": [12.6333, -12.8167],
    "saraya": [12.8333, -11.75],
    "kolda": [12.8833, -14.95],
    "medina-yoro-foulah": [13.2928, -14.7147],
    "velingara": [13.15, -14.1167],
    "louga": [15.6144, -16.2286],
    "kebemer": [15.3667, -16.45],
    "linguere": [15.3953, -15.1194],
    "dahra": [15.35, -15.4833],
    "matam": [15.6559, -13.2554],
    "kanel": [15.4917, -13.1764],
    "ourossogui": [15.6, -13.3167],
    "ranerou-ferlo": [15.3, -13.9667],
    "saint-louis": [16.0179, -16.4896],
    "dagana": [16.5167, -15.5],
    "richard-toll": [16.4625, -15.7008],
    "podor": [16.6517, -14.9592],
    "rosso-senegal": [16.5, -15.8167],
    "sedhiou": [12.7081, -15.5569],
    "bounkiling": [13.0417, -15.6958],
    "goudomp": [12.5778, -15.8722],
    "tambacounda": [13.7707, -13.6673],
    "bakel": [14.9, -12.4667],
    "goudiry": [14.1833, -12.7167],
    "koumpentoum": [13.9833, -14.55],
    "thies": [14.791, -16.9359],
    "mbour": [14.4167, -16.9667],
    "saly": [14.447, -17.017],
    "somone": [14.485, -17.078],
    "tivaouane": [14.95, -16.8167],
    "joal-fadiouth": [14.1667, -16.8333],
    "ngaparou": [14.464, -17.052],
    "popenguine": [14.553, -17.114],
    "ziguinchor": [12.5833, -16.2719],
    "bignona": [12.8103, -16.2264],
    "oussouye": [12.485, -16.5469],
    "cap-skirring": [12.393, -16.746],
  };

  const SENEGAL_VIEW = { center: [14.45, -14.45], zoom: 6 };
  const DEFAULT_TILES = {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; contributeurs <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
  };
  const POPUP_LINKS = 5;

  const scriptUrl = document.currentScript?.src || `${window.location.origin}/config/senegal-map.js`;
  const vendorUrl = (file) => new URL(`../vendor/leaflet/${file}`, scriptUrl).href;
  const maps = new WeakMap();
  let leafletPromise = null;

  function slug(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function cityCoordinates(city) {
    return CITY_COORDINATES[slug(city)] || null;
  }

  function loadLeaflet() {
    if (window.L?.map) return Promise.resolve(window.L);
    if (!leafletPromise) {
      leafletPromise = new Promise((resolve, reject) => {
        const style = document.createElement("link");
        style.rel = "stylesheet";
        style.href = vendorUrl("leaflet.css");
        const ownStyle = document.createElement("link");
        ownStyle.rel = "stylesheet";
        ownStyle.href = new URL("./senegal-map.css", scriptUrl).href;
        document.head.append(style, ownStyle);

        const script = document.createElement("script");
        script.src = vendorUrl("leaflet.js");
        script.onload = () => (window.L?.map ? resolve(window.L) : reject(new Error("Leaflet indisponible")));
        script.onerror = () => reject(new Error("Leaflet indisponible"));
        document.head.append(script);
      }).catch((error) => {
        leafletPromise = null;
        throw error;
      });
    }
    return leafletPromise;
  }

  function groupByCity(items) {
    const groups = new Map();
    let unplaced = 0;
    for (const item of items) {
      const coordinates = cityCoordinates(item.city);
      if (!coordinates) {
        unplaced += 1;
        continue;
      }
      const key = slug(item.city);
      if (!groups.has(key)) groups.set(key, { city: item.city, coordinates, items: [] });
      groups.get(key).items.push(item);
    }
    return { groups: [...groups.values()], unplaced };
  }

  function popupContent(group, countLabel) {
    const box = document.createElement("div");
    box.className = "pencmi-map-popup";
    const title = document.createElement("strong");
    title.textContent = group.city;
    const count = document.createElement("p");
    count.textContent = countLabel(group.items.length);
    const list = document.createElement("ul");
    for (const item of group.items.slice(0, POPUP_LINKS)) {
      const row = document.createElement("li");
      const link = document.createElement("a");
      link.href = item.href;
      link.textContent = item.title || "Voir l’annonce";
      row.append(link);
      if (item.detail) row.append(` · ${item.detail}`);
      list.append(row);
    }
    box.append(title, count, list);
    if (group.items.length > POPUP_LINKS) {
      const more = document.createElement("p");
      more.textContent = `+ ${group.items.length - POPUP_LINKS} dans la liste`;
      box.append(more);
    }
    return box;
  }

  // items: [{ city, title, href, detail, toCity }]. Returns { placed, unplaced }.
  // toCity (trips) draws a line from the marker to the destination city.
  async function render(container, items, options = {}) {
    const L = await loadLeaflet();
    if (!container.isConnected) return { placed: 0, unplaced: 0 };
    maps.get(container)?.remove();

    const config = window.PencmiRuntimeConfig || {};
    const map = L.map(container, { scrollWheelZoom: false });
    maps.set(container, map);
    L.tileLayer(config.mapTileUrl || DEFAULT_TILES.url, {
      maxZoom: 18,
      attribution: config.mapTileAttribution || DEFAULT_TILES.attribution,
    }).addTo(map);

    const countLabel = options.countLabel || ((count) => `${count} annonce${count > 1 ? "s" : ""}`);
    const { groups, unplaced } = groupByCity(items);
    for (const group of groups) {
      const icon = L.divIcon({
        className: "pencmi-map-marker",
        html: `<span>${group.items.length}</span>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -16],
      });
      L.marker(group.coordinates, { icon, title: `${group.city} : ${countLabel(group.items.length)}`, alt: group.city })
        .bindPopup(popupContent(group, countLabel))
        .addTo(map);
    }

    const points = groups.map((group) => group.coordinates);
    const drawn = new Set();
    for (const item of items) {
      const from = cityCoordinates(item.city);
      const to = cityCoordinates(item.toCity);
      const key = `${slug(item.city)}>${slug(item.toCity)}`;
      if (!from || !to || drawn.has(key)) continue;
      drawn.add(key);
      L.polyline([from, to], { color: "#1f5fbf", weight: 2, opacity: 0.6, interactive: false }).addTo(map);
      L.circleMarker(to, { radius: 5, color: "#1f5fbf", weight: 2, fillColor: "#fff", fillOpacity: 1 })
        .bindTooltip(item.toCity)
        .addTo(map);
      points.push(to);
    }

    const focus = cityCoordinates(options.focusCity);
    if (points.length > 1) {
      map.fitBounds(points, { padding: [36, 36], maxZoom: 12 });
    } else if (groups.length === 1) {
      map.setView(groups[0].coordinates, 11);
    } else if (focus) {
      map.setView(focus, 11);
    } else {
      map.setView(SENEGAL_VIEW.center, SENEGAL_VIEW.zoom);
    }

    return { placed: items.length - unplaced, unplaced };
  }

  // Fills a panel element with the map and a short explanatory note.
  async function mount(panel, items, options = {}) {
    const canvas = document.createElement("div");
    canvas.className = "pencmi-map-canvas";
    const note = document.createElement("p");
    note.className = "pencmi-map-note";
    note.setAttribute("role", "status");
    note.textContent = "Chargement de la carte...";
    panel.replaceChildren(canvas, note);

    const result = await render(canvas, items, options);
    const parts = [options.note || "Les annonces de cette page sont regroupées par ville."];
    if (result.unplaced) {
      parts.push(result.unplaced > 1
        ? `${result.unplaced} résultats sans ville reconnue ne figurent pas sur la carte.`
        : "1 résultat sans ville reconnue ne figure pas sur la carte.");
    }
    note.textContent = parts.join(" ");
    return result;
  }

  window.PencmiMap = Object.freeze({ render, mount, cityCoordinates });
})();
