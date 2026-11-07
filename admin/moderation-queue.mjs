import { apiRequest, el, formatDateTime } from "../messaging/messaging-ui.mjs";

const routes = {
  real_estate: "real-estate",
  hotels: "hotels",
  vehicles: "vehicles",
  trips: "trips",
};
const decisions = {
  pending_review: [
    ["active", "Valider"],
    ["refused", "Refuser"],
  ],
  active: [["suspended", "Suspendre"]],
  suspended: [
    ["active", "Réactiver"],
    ["refused", "Refuser"],
  ],
};
const statusKeys = [
  "draft",
  "pending_review",
  "active",
  "refused",
  "suspended",
  "expired",
];
const replace = (root, ...nodes) =>
  root.replaceChildren(...nodes.filter(Boolean));
const price = (value, currency = "FCFA") =>
  `${Number(value).toLocaleString("fr-FR")} ${currency}`;

function button(text, onClick, variant = "light") {
  return el("button", {
    type: "button",
    class: `btn btn-${variant}`,
    text,
    onClick,
  });
}

function gallery(detail, base, objectUrls) {
  let index = 0;
  let request = 0;
  let currentUrl;
  const content = el("div", {
    class: "moderation-photo",
    "aria-live": "polite",
  });
  const previous = button("Précédente", () => show(index - 1));
  const next = button("Suivante", () => show(index + 1));
  async function show(position) {
    index = position;
    const version = ++request;
    previous.disabled = index === 0;
    next.disabled = index >= detail.photos.length - 1;
    content.replaceChildren(
      el("p", {
        text: `Photo ${index + 1} sur ${detail.photos.length} : chargement…`,
      }),
    );
    try {
      const blob = await apiRequest(
        `${base}/photos/${encodeURIComponent(detail.photos[index].id)}`,
        { binary: true },
      );
      if (version !== request || !content.isConnected) return;
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
        objectUrls.delete(currentUrl);
      }
      currentUrl = URL.createObjectURL(blob);
      objectUrls.add(currentUrl);
      content.replaceChildren(
        el("img", {
          src: currentUrl,
          alt: `Photo ${index + 1} sur ${detail.photos.length}`,
        }),
      );
    } catch (error) {
      if (version === request)
        content.replaceChildren(
          el("p", { role: "alert", text: error.message }),
          button("Réessayer", () => show(index)),
        );
    }
  }
  const fold = el(
    "details",
    {},
    el("summary", { text: `Photos (${detail.photos.length})` }),
    content,
    detail.photos.length > 1
      ? el("div", { class: "moderation-actions" }, previous, next)
      : null,
  );
  fold.addEventListener("toggle", () => {
    if (fold.open && !request) void show(0);
  });
  return fold;
}

export function mountModerationQueue(
  root,
  { module, pendingOnly, modules, statuses, refreshCounts },
) {
  const params = new URLSearchParams(location.search);
  const initialStatus = params.has("status")
    ? params.get("status")
    : pendingOnly
      ? "pending_review"
      : "";
  const select = (label, options, value) => {
    const field = el(
      "select",
      {},
      el("option", { value: "", text: "Tous" }),
      options.map(([key, text]) => el("option", { value: key, text })),
    );
    field.value = value;
    return { field, node: el("label", {}, el("span", { text: label }), field) };
  };
  const universe = select(
    "Univers",
    Object.entries(modules).filter(([key]) => routes[key]),
    params.get("module") || "",
  );
  const status = select(
    "Statut",
    statusKeys.map((key) => [key, statuses[key]]),
    initialStatus,
  );
  const advertiser = el("input", {
    type: "search",
    maxLength: 120,
    value: params.get("advertiser") || "",
  });
  const search = el("input", {
    type: "search",
    maxLength: 120,
    value: params.get("search") || "",
  });
  const result = el("div");
  const count = el("p", { role: "status", class: "moderation-count" });
  const feedback = el("p", { role: "status", class: "moderation-feedback" });
  const dialog = el("dialog", {
    class: "moderation-dialog",
    "aria-labelledby": "moderation-dialog-title",
  });
  let page = 1;
  let request = 0;
  let saving = false;
  let opener;
  const urls = new Set();
  dialog.addEventListener("cancel", (event) => {
    if (saving) event.preventDefault();
  });
  dialog.addEventListener("close", () => {
    for (const url of urls) URL.revokeObjectURL(url);
    urls.clear();
    dialog.replaceChildren();
    opener?.focus();
  });
  const form = el(
    "form",
    {
      class: "moderation-filters",
      onSubmit: (event) => {
        event.preventDefault();
        page = 1;
        feedback.textContent = "";
        void load();
      },
    },
    module ? null : universe.node,
    status.node,
    el("label", {}, el("span", { text: "Annonceur" }), advertiser),
    el(
      "label",
      {},
      el("span", { text: "Annonce, ville ou identifiant" }),
      search,
    ),
    el("button", { type: "submit", class: "btn btn-primary", text: "Filtrer" }),
  );
  root.replaceChildren(form, feedback, count, result, dialog);

  async function load() {
    const version = ++request;
    const query = new URLSearchParams({ page, limit: 20 });
    const selection = module || universe.field.value;
    for (const [key, value] of Object.entries({
      status: status.field.value,
      advertiser: advertiser.value.trim(),
      search: search.value.trim(),
    })) {
      if (value) query.set(key, value);
    }
    const endpoint =
      selection && selection !== "trips"
        ? `/admin/listings/${routes[selection]}`
        : "/admin/validation";
    if (selection === "trips") query.set("module", selection);
    count.textContent = "Chargement des annonces…";
    result.replaceChildren();
    try {
      const { data, meta } = await apiRequest(`${endpoint}?${query}`, {
        includeMeta: true,
      });
      if (version !== request) return;
      if (page > 1 && page > meta.totalPages) {
        page = Math.max(1, meta.totalPages);
        return load();
      }
      count.textContent = `${meta.total.toLocaleString("fr-FR")} annonce${meta.total === 1 ? "" : "s"}`;
      const list = el(
        "ul",
        { class: "moderation-list" },
        data.map((row) => {
          const title = row.title || "Annonce sans titre";
          const review = button("Examiner", () => open(row, review));
          review.setAttribute("aria-label", `Examiner ${title}`);
          return el(
            "li",
            { class: "moderation-row" },
            el(
              "div",
              {},
              el("h2", { text: title }),
              el("p", {
                text: [modules[row.module], row.advertiser, row.city]
                  .filter(Boolean)
                  .join(" · "),
              }),
            ),
            el(
              "div",
              {},
              el("strong", { text: statuses[row.status] }),
              el("p", { text: formatDateTime(row.updatedAt) }),
            ),
            review,
          );
        }),
      );
      const pager = el(
        "nav",
        {
          class: "moderation-actions",
          "aria-label": "Pagination des annonces",
        },
        page > 1
          ? button("Précédent", () => {
              page--;
              void load();
            })
          : null,
        el("span", { text: `Page ${page} sur ${meta.totalPages}` }),
        page < meta.totalPages
          ? button("Suivant", () => {
              page++;
              void load();
            })
          : null,
      );
      replace(
        result,
        data.length
          ? list
          : el("p", { text: "Aucune annonce ne correspond aux filtres." }),
        meta.totalPages > 1 ? pager : null,
      );
    } catch (error) {
      if (version !== request) return;
      count.textContent = "";
      result.replaceChildren(
        el("p", { role: "alert", text: error.message }),
        button("Réessayer", load),
      );
    }
  }

  async function open(row, control) {
    if (dialog.open) return;
    opener = control;
    const title = el("h2", {
      id: "moderation-dialog-title",
      text: row.title || "Annonce sans titre",
    });
    const close = button("Fermer", () => dialog.close());
    const body = el(
      "div",
      {},
      el("p", { role: "status", text: "Chargement du détail…" }),
    );
    dialog.replaceChildren(
      el("header", { class: "moderation-dialog-header" }, title, close),
      body,
    );
    dialog.showModal();
    const id = encodeURIComponent(row.id);
    const base = `/admin/validation/${row.module}/${id}`;
    try {
      const detail = await apiRequest(base);
      if (!body.isConnected) return;
      title.textContent = detail.title || "Annonce sans titre";
      const details = [
        ["Univers", modules[detail.module]],
        ["Annonceur", detail.advertiser],
        ["Ville ou trajet", detail.city],
        ["Statut", statuses[detail.status]],
        ["Type", detail.kind],
        [
          "Tarif",
          detail.price == null ? null : price(detail.price, detail.currency),
        ],
        [
          "Départ",
          detail.departureDate
            ? `${formatDateTime(detail.departureDate).split(" ")[0]} ${detail.departureTime || ""}`
            : null,
        ],
        ["Places déclarées", detail.seats],
      ];
      const choices = el("div", { class: "moderation-actions" });
      const confirmation = el("div");
      for (const [next, label] of decisions[detail.status] || []) {
        choices.append(
          button(
            label,
            () => choose(next, label),
            next === "active" ? "primary" : "light",
          ),
        );
      }
      replace(
        body,
        el(
          "dl",
          { class: "moderation-facts" },
          details
            .filter(([, value]) => value != null && value !== "")
            .map(([label, value]) =>
              el(
                "div",
                {},
                el("dt", { text: label }),
                el("dd", { text: value }),
              ),
            ),
        ),
        detail.description
          ? el("p", {
              class: "moderation-description",
              text: detail.description,
            })
          : null,
        detail.rooms.length
          ? el(
              "section",
              {},
              el("h3", { text: "Catégories de chambres" }),
              el(
                "ul",
                {},
                detail.rooms.map((room) =>
                  el("li", {
                    text: [
                      room.name,
                      statuses[room.status],
                      room.capacity == null
                        ? null
                        : `${room.capacity} voyageurs`,
                      room.totalUnits == null
                        ? null
                        : `${room.totalUnits} unités`,
                      room.basePrice == null
                        ? null
                        : `${price(room.basePrice)} / nuit`,
                    ]
                      .filter(Boolean)
                      .join(" · "),
                  }),
                ),
              ),
            )
          : null,
        detail.photos.length ? gallery(detail, base, urls) : null,
        choices,
        confirmation,
      );

      function choose(next, label) {
        choices.hidden = true;
        const reason = el("textarea", {
          maxLength: 2000,
          required: next !== "active",
          rows: 3,
          name: "reason",
        });
        const errorBox = el("div", { role: "alert" });
        const confirm = el("button", {
          type: "submit",
          class: "btn btn-primary",
          text: `Confirmer : ${label.toLowerCase()}`,
        });
        const cancel = button("Annuler la décision", () => {
          confirmation.replaceChildren();
          choices.hidden = false;
          choices.firstElementChild?.focus();
        });
        const decisionForm = el(
          "form",
          {
            class: "moderation-decision",
            onSubmit: async (event) => {
              event.preventDefault();
              if (saving) return;
              const motif = reason.value.trim();
              if (next !== "active" && !motif) {
                errorBox.textContent = "Renseignez le motif de la décision.";
                reason.focus();
                return;
              }
              saving = true;
              close.disabled =
                confirm.disabled =
                reason.disabled =
                cancel.disabled =
                  true;
              errorBox.textContent = "";
              try {
                await apiRequest(
                  `/admin/listings/${routes[detail.module]}/${id}/status`,
                  {
                    method: "PATCH",
                    body: {
                      status: next,
                      expectedUpdatedAt: detail.updatedAt,
                      ...(motif ? { reason: motif } : {}),
                    },
                  },
                );
                feedback.textContent = "Décision enregistrée.";
                dialog.close();
                await Promise.all([load(), refreshCounts()]);
              } catch (error) {
                replace(
                  errorBox,
                  el("p", { text: error.message }),
                  error.fields?.length
                    ? el(
                        "ul",
                        {},
                        error.fields.map((field) =>
                          el("li", {
                            text: `${field.path} : ${field.message}`,
                          }),
                        ),
                      )
                    : null,
                  error.status === 409
                    ? button("Actualiser la file", () => {
                        dialog.close();
                        void load();
                      })
                    : null,
                );
              } finally {
                saving = false;
                close.disabled =
                  confirm.disabled =
                  reason.disabled =
                  cancel.disabled =
                    false;
              }
            },
          },
          el("h3", { text: `${label} cette annonce ?` }),
          el(
            "label",
            {},
            el("span", {
              text:
                next === "active"
                  ? "Motif (facultatif)"
                  : "Motif (obligatoire)",
            }),
            reason,
          ),
          errorBox,
          el("div", { class: "moderation-actions" }, confirm, cancel),
        );
        confirmation.replaceChildren(decisionForm);
        reason.focus();
      }
    } catch (error) {
      if (body.isConnected)
        body.replaceChildren(el("p", { role: "alert", text: error.message }));
    }
  }
  void load();
}
