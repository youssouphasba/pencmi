const SENEGAL_LOCATIONS = [
  {
    region: "Dakar",
    departments: ["Dakar", "Guédiawaye", "Keur Massar", "Pikine", "Rufisque"],
    cities: ["Dakar", "Guédiawaye", "Keur Massar", "Pikine", "Rufisque", "Diamniadio", "Bargny", "Sébikotane"]
  },
  {
    region: "Diourbel",
    departments: ["Diourbel", "Bambey", "Mbacké"],
    cities: ["Diourbel", "Bambey", "Mbacké", "Touba"]
  },
  {
    region: "Fatick",
    departments: ["Fatick", "Foundiougne", "Gossas"],
    cities: ["Fatick", "Foundiougne", "Gossas", "Sokone"]
  },
  {
    region: "Kaffrine",
    departments: ["Kaffrine", "Birkilane", "Koungheul", "Malem Hodar"],
    cities: ["Kaffrine", "Birkilane", "Koungheul", "Malem Hodar"]
  },
  {
    region: "Kaolack",
    departments: ["Kaolack", "Guinguinéo", "Nioro du Rip"],
    cities: ["Kaolack", "Guinguinéo", "Nioro du Rip"]
  },
  {
    region: "Kédougou",
    departments: ["Kédougou", "Salémata", "Saraya"],
    cities: ["Kédougou", "Salémata", "Saraya"]
  },
  {
    region: "Kolda",
    departments: ["Kolda", "Médina Yoro Foulah", "Vélingara"],
    cities: ["Kolda", "Médina Yoro Foulah", "Vélingara"]
  },
  {
    region: "Louga",
    departments: ["Louga", "Kébémer", "Linguère"],
    cities: ["Louga", "Kébémer", "Linguère", "Dahra"]
  },
  {
    region: "Matam",
    departments: ["Matam", "Kanel", "Ranérou-Ferlo"],
    cities: ["Matam", "Kanel", "Ourossogui", "Ranérou-Ferlo"]
  },
  {
    region: "Saint-Louis",
    departments: ["Saint-Louis", "Dagana", "Podor"],
    cities: ["Saint-Louis", "Dagana", "Richard-Toll", "Podor", "Rosso Sénégal"]
  },
  {
    region: "Sédhiou",
    departments: ["Sédhiou", "Bounkiling", "Goudomp"],
    cities: ["Sédhiou", "Bounkiling", "Goudomp"]
  },
  {
    region: "Tambacounda",
    departments: ["Tambacounda", "Bakel", "Goudiry", "Koumpentoum"],
    cities: ["Tambacounda", "Bakel", "Goudiry", "Koumpentoum"]
  },
  {
    region: "Thiès",
    departments: ["Thiès", "Mbour", "Tivaouane"],
    cities: ["Thiès", "Mbour", "Saly", "Somone", "Tivaouane", "Joal-Fadiouth", "Ngaparou", "Popenguine"]
  },
  {
    region: "Ziguinchor",
    departments: ["Ziguinchor", "Bignona", "Oussouye"],
    cities: ["Ziguinchor", "Bignona", "Oussouye", "Cap Skirring"]
  }
];

const RADIUS_OPTIONS = [
  { label: "Aucun rayon", value: "" },
  { label: "5 km", value: "5" },
  { label: "10 km", value: "10" },
  { label: "15 km", value: "15" },
  { label: "20 km", value: "20" },
  { label: "25 km", value: "25" },
  { label: "30 km", value: "30" },
  { label: "40 km", value: "40" },
  { label: "50 km", value: "50" },
  { label: "75 km", value: "75" },
  { label: "100 km", value: "100" },
  { label: "Tout le Sénégal", value: "all" }
];

function slugifyLocation(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function findLocationRegion(regionSlug) {
  return SENEGAL_LOCATIONS.find((location) => slugifyLocation(location.region) === regionSlug);
}

function buildLocationQuery(locationFilters) {
  const params = new URLSearchParams();

  if (locationFilters.country === "SN") {
    params.set("country", "SN");
    return params;
  }

  if (locationFilters.nearMe) {
    params.set("nearMe", "true");
    if (locationFilters.radius && locationFilters.radius !== "all") {
      params.set("radius", locationFilters.radius);
    }
    return params;
  }

  ["region", "department", "city", "district"].forEach((key) => {
    if (locationFilters[key]) {
      params.set(key, slugifyLocation(locationFilters[key]));
    }
  });

  if (locationFilters.radius && locationFilters.radius !== "all") {
    params.set("radius", locationFilters.radius);
  }

  return params;
}

function parseLocationParams(search = window.location.search) {
  const params = new URLSearchParams(search);

  return {
    country: params.get("country") || "",
    region: params.get("region") || "",
    department: params.get("department") || "",
    city: params.get("city") || "",
    district: params.get("district") || "",
    radius: params.get("radius") || "",
    nearMe: params.get("nearMe") === "true"
  };
}
