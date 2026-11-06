if (new URLSearchParams(location.search).get("category") === "voyage") {
  void (async () => {
    const [
      { publicationRequest: api, publicationOperationId: uuid },
      {
        tripTypes,
        tripStatuses,
        tripSteps,
        tripConditions,
        tripCopy,
        tripEscape: esc,
        emptyTripDraft,
        tripDraftFromListing,
        tripFieldStep,
      },
    ] = await Promise.all([
      import("./real-estate-api.mjs"),
      import("../voyages/trip-content.mjs"),
    ]);
    const root = document.querySelector("#publish-page");
    document.body.dataset.tripPublication = "";
    document.title = "Publier un trajet - Péncmi";
    let step = 0,
      draft = emptyTripDraft(),
      id = new URLSearchParams(location.search).get("id"),
      busy = false,
      status = "draft",
      message = "",
      error = "",
      fields = [];
    let moderationReason = "";
    const requestId = sessionStorage.getItem("pencmi_trip_creation") || uuid();
    const get = (path) => path.split(".").reduce((v, k) => v?.[k], draft);
    const set = (path, value) => {
      const keys = path.split("."),
        key = keys.pop();
      const target = keys.reduce((obj, k) => (obj[k] ||= {}), draft);
      if (value === undefined) delete target[key];
      else target[key] = value;
      message = "";
    };
    function field(path, label, type = "text", choices) {
      const value = get(path) ?? "",
        issue = fields.find((f) => f.path === path);
      const attrs = `data-trip-field="${path}"${issue ? ' aria-invalid="true"' : ""}`;
      const input = choices
        ? `<select ${attrs}><option value="">Sélectionner</option>${Object.entries(
            choices,
          )
            .map(
              ([key, text]) =>
                `<option value="${esc(key)}"${value === key ? " selected" : ""}>${esc(text)}</option>`,
            )
            .join("")}</select>`
        : type === "textarea"
          ? `<textarea ${attrs} maxlength="6000">${esc(value)}</textarea>`
          : `<input ${attrs} type="${type}" value="${esc(value)}"${type === "number" ? ' min="0" step="1" max="2147483647"' : ""} maxlength="500">`;
      return `<label class="form-field"><span>${esc(label)}</span>${input}${issue ? `<small class="form-error">${esc(issue.message)}</small>` : ""}</label>`;
    }
    const check = (path, label) =>
      `<label class="choice-card"><input type="checkbox" data-trip-field="${path}"${get(path) ? " checked" : ""}><span>${esc(label)}</span></label>`;
    function routeRows(key, labels) {
      return `<section class="full"><h3>${esc(labels[0])}</h3>${(draft.route[key] || []).map((row, index) => `<div class="form-grid">${key === "stops" ? field(`route.${key}.${index}.city`, "Ville") + field(`route.${key}.${index}.point`, "Point de montée ou descente") + field(`route.${key}.${index}.arrivalTime`, "Heure estimée", "time") + check(`route.${key}.${index}.nextDay`, "Le lendemain") + check(`route.${key}.${index}.boarding`, "Montée autorisée") + check(`route.${key}.${index}.alighting`, "Descente autorisée") : field(`route.${key}.${index}.label`, "Nom du rendez-vous") + field(`route.${key}.${index}.point`, "Lieu")}<button type="button" class="btn btn-ghost" data-remove-route="${key}" data-index="${index}">Retirer</button></div>`).join("")}<button type="button" class="btn btn-light" data-add-route="${key}"${(draft.route[key]?.length || 0) >= 20 ? " disabled" : ""}>${esc(labels[1])}</button></section>`;
    }
    function content() {
      switch (step) {
        case 0:
          return field("vehicleType", "Type de transport", "text", tripTypes);
        case 1:
          return (
            field("route.departureCity", "Ville de départ") +
            field("route.departurePoint", "Gare ou point de départ") +
            field("route.arrivalCity", "Ville d’arrivée") +
            field("route.arrivalPoint", "Point d’arrivée") +
            field(
              "route.meetingPoints",
              "Points de rendez-vous supplémentaires",
              "textarea",
            ) +
            check("route.approximate", "Localisation approximative") +
            routeRows("stops", [
              "Arrêts intermédiaires ordonnés",
              "Ajouter un arrêt",
            ]) +
            routeRows("rendezvous", [
              "Points de rendez-vous",
              "Ajouter un rendez-vous",
            ])
          );
        case 2:
          return (
            field("schedule.date", "Date du départ", "date") +
            field("schedule.departureTime", "Heure de départ (Dakar)", "time") +
            field("schedule.arrivalTime", "Heure d’arrivée estimée", "time") +
            check("schedule.arrivalNextDay", "Arrivée le lendemain") +
            field(
              "schedule.durationMinutes",
              "Durée estimée (minutes)",
              "number",
            ) +
            check("schedule.regular", "Voyage régulier") +
            (draft.schedule.regular
              ? field(
                  "schedule.validUntil",
                  "Fin de la période (90 jours maximum)",
                  "date",
                ) +
                field(
                  "schedule.intervalWeeks",
                  "Fréquence en semaines (1 à 4)",
                  "number",
                ) +
                `<fieldset class="full"><legend>Jours de circulation</legend><div class="checkbox-list">${["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"].map((label, day) => `<label class="choice-card"><input type="checkbox" data-trip-weekday="${day}"${draft.schedule.weekdays?.includes(day) ? " checked" : ""}><span>${label}</span></label>`).join("")}</div></fieldset><label class="form-field full"><span>Exceptions de service (dates séparées par des virgules)</span><textarea data-trip-exceptions>${esc((draft.schedule.excludedDates || []).join(", "))}</textarea></label>`
              : "")
          );
        case 3:
          return (
            field("vehicle.brand", "Marque") +
            field("vehicle.model", "Modèle") +
            field("vehicle.totalSeats", "Nombre total de places", "number") +
            check("vehicle.airConditioning", "Climatisation") +
            field(
              "vehicle.passengerInfo",
              "Informations pour les passagers",
              "textarea",
            )
          );
        case 4:
          return (
            field("pricing.availableSeats", "Places proposées", "number") +
            field(
              "pricing.pricePerSeat",
              "Prix par personne (FCFA)",
              "number",
            ) +
            check("pricing.luggageIncluded", "Bagages inclus dans le prix") +
            field(
              "pricing.luggageExtra",
              "Supplément bagage (FCFA)",
              "number",
            ) +
            check("pricing.negotiable", "Prix négociable")
          );
        case 5:
          return `<div class="checkbox-list">${tripConditions.map((item) => `<label class="choice-card"><input type="checkbox" data-trip-condition value="${esc(item)}"${draft.conditions.includes(item) ? " checked" : ""}><span>${esc(item)}</span></label>`).join("")}</div>`;
        case 6:
          return (
            field("content.title", "Titre du trajet") +
            field("content.description", "Description", "textarea") +
            field("content.instructions", "Consignes particulières", "textarea")
          );
        case 7:
          return (
            check("contactPreferences.phoneEnabled", "Téléphone") +
            field(
              "contactPreferences.phoneNumber",
              "Numéro de téléphone",
              "tel",
            ) +
            check("contactPreferences.whatsappEnabled", "WhatsApp") +
            field(
              "contactPreferences.whatsappNumber",
              "Numéro WhatsApp",
              "tel",
            ) +
            check("contactPreferences.emailEnabled", "Email public") +
            field(
              "contactPreferences.contactEmail",
              "Email de contact",
              "email",
            ) +
            check(
              "contactPreferences.reservationRequestEnabled",
              "Demande de place",
            ) +
            check(
              "contactPreferences.internalMessagingEnabled",
              "Messagerie interne Péncmi",
            )
          );
        case 8:
          return `<div class="preview-box"><h2>${esc(draft.content.title)}</h2><p>${esc(draft.route.departureCity)} → ${esc(draft.route.arrivalCity)}</p><p>${esc(draft.route.departurePoint)} → ${esc(draft.route.arrivalPoint)}</p><p>${esc(draft.schedule.date)} ${esc(draft.schedule.departureTime)} (Dakar)</p>${draft.schedule.regular ? `<p>Programme régulier jusqu’au ${esc(draft.schedule.validUntil)} · toutes les ${esc(draft.schedule.intervalWeeks || 1)} semaine(s)</p><p>${(draft.schedule.weekdays || []).map((day) => esc(new Intl.DateTimeFormat("fr-SN", { weekday: "long", timeZone: "Africa/Dakar" }).format(new Date(Date.UTC(2026, 10, 1 + day))))).join(", ")}</p>${draft.schedule.excludedDates?.length ? `<p>Exceptions : ${draft.schedule.excludedDates.map(esc).join(", ")}</p>` : ""}` : ""}${draft.schedule.arrivalTime ? `<p>Arrivée estimée : ${esc(draft.schedule.arrivalTime)}${draft.schedule.arrivalNextDay || draft.schedule.arrivalTime < draft.schedule.departureTime ? " le lendemain" : ""}</p>` : ""}${draft.schedule.durationMinutes ? `<p>Durée estimée : ${esc(draft.schedule.durationMinutes)} min</p>` : ""}${draft.route.stops?.length ? `<h3>Arrêts</h3><ol>${draft.route.stops.map((stop) => `<li>${esc(stop.city)} · ${esc(stop.point)}${stop.arrivalTime ? ` · ${esc(stop.arrivalTime)}${stop.nextDay ? " le lendemain" : ""}` : ""}${stop.boarding ? " · Montée" : ""}${stop.alighting ? " · Descente" : ""}</li>`).join("")}</ol>` : ""}${draft.route.rendezvous?.length ? `<h3>Points de rendez-vous</h3><ul>${draft.route.rendezvous.map((point) => `<li>${esc(point.label)} : ${esc(point.point)}</li>`).join("")}</ul>` : ""}<p>${esc(draft.vehicleType ? tripTypes[draft.vehicleType] : "")}</p><p>${esc(draft.pricing.availableSeats)} places · ${esc(draft.pricing.pricePerSeat)} FCFA par personne</p><p>${esc(draft.content.description)}</p><p>${esc(draft.content.instructions)}</p><p>${esc(tripCopy.declaredSeats)}</p></div>`;
        default:
          return '<p>Votre trajet sera soumis à validation avant sa mise en ligne.</p><button class="btn btn-primary" type="button" data-submit-trip>Soumettre le trajet</button>';
      }
    }
    function render() {
      document.querySelector("#publish-header").innerHTML =
        '<a class="brand" href="/" aria-label="Accueil Péncmi"><img src="/Logo%20pencmi.jpeg" width="64" height="64" style="object-fit:contain" alt="Péncmi"></a><div class="header-actions"><a class="btn btn-ghost" href="/voyages/">Voyages</a><a class="btn btn-light" href="/dashboard/voyages/trajets/">Mes trajets</a></div>';
      root.innerHTML = `<div class="publish-shell"><section class="publish-main"><div class="publish-top"><h1>Publier un trajet</h1><p>Étape ${step + 1} sur 10 · ${esc(tripStatuses[status] || status)}</p></div><nav class="stepper" aria-label="Étapes">${tripSteps.map((name, index) => `<button type="button" class="step-pill${index === step ? " is-active" : ""}" data-trip-step="${index}">${index + 1}. ${esc(name)}</button>`).join("")}</nav><section class="step-card"><h2>${esc(tripSteps[step])}</h2><div class="form-grid">${content()}</div></section>${error ? `<div class="form-error" role="alert">${esc(error)}</div>` : ""}${message ? `<div class="status-message" role="status">${esc(message)}</div>` : ""}<div class="publish-nav"><div class="publish-nav-group"><button class="btn btn-ghost" data-prev-trip${!step ? " disabled" : ""}>Retour</button><button class="btn btn-light" data-draft-trip>Enregistrer en brouillon</button></div><div class="publish-nav-group"><button class="btn btn-ghost" data-preview-trip>Prévisualiser</button><button class="btn btn-primary" data-next-trip>${step === 9 ? "Soumettre" : "Suivant"}</button></div></div></section></div>`;
      root
        .querySelectorAll("[data-trip-field]")
        .forEach((input) =>
          input.addEventListener("input", () =>
            set(
              input.dataset.tripField,
              input.type === "checkbox"
                ? input.checked
                : input.type === "number"
                  ? input.value === ""
                    ? undefined
                    : Number(input.value)
                  : input.value,
            ),
          ),
        );
      root
        .querySelector('[data-trip-field="schedule.regular"]')
        ?.addEventListener("change", () => render());
      root.querySelectorAll("[data-trip-weekday]").forEach(
        (input) =>
          (input.onchange = () => {
            draft.schedule.weekdays = [
              ...root.querySelectorAll("[data-trip-weekday]:checked"),
            ].map((item) => Number(item.dataset.tripWeekday));
          }),
      );
      root
        .querySelector("[data-trip-exceptions]")
        ?.addEventListener("input", (event) => {
          draft.schedule.excludedDates = event.target.value
            .split(/[\s,;]+/)
            .filter(Boolean);
        });
      root.querySelectorAll("[data-add-route]").forEach(
        (button) =>
          (button.onclick = () => {
            const key = button.dataset.addRoute;
            (draft.route[key] ||= []).push(
              key === "stops"
                ? { city: "", point: "" }
                : { label: "", point: "" },
            );
            render();
          }),
      );
      root.querySelectorAll("[data-remove-route]").forEach(
        (button) =>
          (button.onclick = () => {
            draft.route[button.dataset.removeRoute].splice(
              Number(button.dataset.index),
              1,
            );
            render();
          }),
      );
      if (moderationReason) {
        const notice = document.createElement("p");
        notice.className = "form-error";
        notice.textContent =
          "Dernier motif de modération : " + moderationReason;
        root.querySelector(".publish-top").append(notice);
      }
      root.querySelectorAll("[data-trip-condition]").forEach((input) =>
        input.addEventListener("change", () => {
          draft.conditions = [
            ...root.querySelectorAll("[data-trip-condition]:checked"),
          ].map((item) => item.value);
          message = "";
        }),
      );
      root.querySelectorAll("[data-trip-step]").forEach(
        (button) =>
          (button.onclick = () => {
            step = Number(button.dataset.tripStep);
            render();
          }),
      );
      root.querySelector("[data-prev-trip]").onclick = () => {
        step = Math.max(0, step - 1);
        render();
      };
      root.querySelector("[data-preview-trip]").onclick = () => {
        step = 8;
        render();
      };
      root.querySelector("[data-next-trip]").onclick = () => {
        if (step === 9) void save(true);
        else {
          step++;
          render();
        }
      };
      root.querySelector("[data-draft-trip]").onclick = () => void save(false);
      root
        .querySelector("[data-submit-trip]")
        ?.addEventListener("click", () => void save(true));
      if (busy)
        root
          .querySelectorAll("button,input,textarea,select")
          .forEach((control) => (control.disabled = true));
    }
    async function save(submit) {
      if (busy) return;
      busy = true;
      error = "";
      message = "";
      fields = [];
      render();
      try {
        if (!id) {
          sessionStorage.setItem("pencmi_trip_creation", requestId);
          const row = await api("/dashboard/voyages", {
            method: "POST",
            body: { requestId, publication: draft },
          });
          id = row.id;
          const url = new URL(location.href);
          url.searchParams.set("id", id);
          history.replaceState(null, "", url);
          sessionStorage.removeItem("pencmi_trip_creation");
        }
        const row = await api(`/dashboard/voyages/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: { publication: draft },
        });
        status = row.status;
        if (submit) {
          const result = await api(
            `/dashboard/voyages/${encodeURIComponent(id)}/submit`,
            { method: "POST" },
          );
          status = result.status;
        }
        message = submit
          ? tripCopy.submitted
          : status === "draft"
            ? tripCopy.saved
            : "Modifications enregistrées.";
      } catch (e) {
        error = e.message;
        fields = e.fields || [];
        if (fields.length) step = tripFieldStep(fields[0].path);
      } finally {
        busy = false;
        render();
      }
    }
    busy = true;
    render();
    try {
      if (id) {
        const row = await api(`/dashboard/voyages/${encodeURIComponent(id)}`);
        draft = tripDraftFromListing(row);
        status = row.status;
        moderationReason = row.moderationReason || "";
      }
    } catch (e) {
      error = e.message;
      root.innerHTML = `<div role="alert">${esc(error)}</div><a href="/dashboard/voyages/trajets/">Retour aux trajets</a>`;
      return;
    }
    busy = false;
    render();
  })().catch((error) => {
    const root = document.querySelector("#publish-page");
    if (root) root.textContent = error.message;
  });
}
