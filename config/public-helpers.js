function pencmiPublicApiBaseUrl() {
  return String(window.PencmiConfig?.apiBaseUrl || window.PencmiRuntimeConfig?.apiBaseUrl || "").replace(/\/+$/, "");
}

async function pencmiApiRequest(path, options = {}) {
  const baseUrl = pencmiPublicApiBaseUrl();
  if (!baseUrl) {
    throw new Error("API inaccessible.");
  }

  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error?.message || "Chargement impossible.");
  }

  return payload?.data ?? payload;
}

function pencmiQueryParams() {
  return new URLSearchParams(window.location.search);
}

function pencmiQueryValue(key, fallback = "") {
  return pencmiQueryParams().get(key) || fallback;
}

function pencmiNormalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function pencmiFormatPrice(value, currency = "FCFA") {
  if (value === null || value === undefined || value === "") {
    return "Prix à confirmer";
  }

  return `${Number(value).toLocaleString("fr-FR")} ${currency}`;
}

function pencmiFormatDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function pencmiBuildAdvertiser(listingOwner) {
  const profile = listingOwner?.professionalProfile || {};
  const name =
    profile.businessName ||
    [listingOwner?.firstName, listingOwner?.lastName].filter(Boolean).join(" ").trim() ||
    "Annonceur";

  return {
    id: listingOwner?.id || "",
    name,
    type: profile.professionalType || listingOwner?.role || "",
    city: profile.city || listingOwner?.city || "",
    logoUrl: profile.logoUrl || listingOwner?.avatarUrl || "",
    phone: profile.professionalPhone || "",
    whatsapp: profile.whatsappNumber || "",
    email: profile.professionalEmail || "",
    website: profile.website || "",
    description: profile.description || "",
    openingHours: profile.openingHours || "",
    verified: Boolean(profile.verified || listingOwner?.professionalVerified),
  };
}

function pencmiListingPhotos(metadata = {}) {
  const photos = Array.isArray(metadata.photos) ? metadata.photos.filter(Boolean) : [];
  const cover = metadata.coverPhoto ? [metadata.coverPhoto] : [];
  return [...new Set([...cover, ...photos])];
}

function pencmiAdvertiserHref(userId) {
  if (!userId) {
    return "#";
  }

  return window.PencmiConfig?.routeHref ? window.PencmiConfig.routeHref(`/annonceurs/${userId}`) : `../annonceurs/?id=${encodeURIComponent(userId)}`;
}
