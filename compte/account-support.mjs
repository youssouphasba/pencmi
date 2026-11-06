import { apiRequest, formatDateTime } from "../messaging/messaging-ui.mjs";
import {
  el,
  accountStyles,
  accountError,
  sessionRequired,
} from "./account-ui.mjs";

export function mountAccountSupport(root) {
  accountStyles();
  if (sessionRequired(root)) return;
  const subject = el("input", {
    name: "subject",
    required: true,
    maxLength: 200,
  });
  const body = el("textarea", {
    name: "body",
    required: true,
    maxLength: 10000,
    rows: 5,
  });
  const status = el("div", { role: "status" });
  const tickets = el("div");
  const send = el("button", {
    class: "btn btn-primary",
    type: "submit",
    text: "Envoyer la demande",
  });
  const form = el(
    "form",
    { class: "ae-form" },
    el("label", {}, el("span", { text: "Sujet" }), subject),
    el("label", {}, el("span", { text: "Message" }), body),
    send,
  );
  let busy = false;
  async function load() {
    tickets.replaceChildren(el("p", { text: "Chargement de vos demandes…" }));
    try {
      const rows = await apiRequest("/support/tickets");
      const labels = {
        open: "Ouverte",
        pending: "En attente",
        resolved: "Résolue",
        closed: "Fermée",
      };
      tickets.replaceChildren(
        el("h2", { text: "Vos dernières demandes" }),
        rows.length
          ? el(
              "div",
              { class: "ae-sessions" },
              rows
                .slice(0, 20)
                .map((ticket) =>
                  el(
                    "article",
                    { class: "ae-session" },
                    el("h3", { text: ticket.subject }),
                    el("p", {
                      text: `${labels[ticket.status] || ticket.status} · ${formatDateTime(ticket.createdAt)}`,
                    }),
                  ),
                ),
            )
          : el("p", {
              text: "Vous n’avez aucune demande de support pour le moment.",
            }),
      );
    } catch (error) {
      accountError(tickets, error, load);
    }
  }
  form.onsubmit = async (event) => {
    event.preventDefault();
    if (busy || !form.reportValidity()) return;
    if (!subject.value.trim() || !body.value.trim()) {
      status.replaceChildren(
        el("p", { role: "alert", text: "Renseignez le sujet et le message." }),
      );
      return;
    }
    busy = true;
    send.disabled = subject.disabled = body.disabled = true;
    status.replaceChildren(el("p", { text: "Envoi en cours…" }));
    try {
      const result = await apiRequest("/support/tickets", {
        method: "POST",
        body: { subject: subject.value.trim(), body: body.value.trim() },
      });
      if (!result?.id)
        throw new Error("La réception de votre demande n’a pas été confirmée.");
      form.reset();
      status.replaceChildren(
        el("p", { text: "Votre demande de support a été enregistrée." }),
      );
      await load();
    } catch (error) {
      accountError(status, error);
    } finally {
      busy = false;
      send.disabled = subject.disabled = body.disabled = false;
    }
  };
  root.replaceChildren(form, status, tickets);
  void load();
}
