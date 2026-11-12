import { apiRequest, formatDateTime } from "../messaging/messaging-ui.mjs";
import { supportStatuses, supportWritable } from './support-copy.mjs';
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
  function ticketCard(ticket) {
    const feedback = el('div', { role: 'status' });
    const reply = el('textarea', { required: true, maxLength: 10000, rows: 3 });
    const sendReply = el('button', { type: 'submit', class: 'btn btn-primary', text: 'Répondre' });
    const replyForm = el('form', { class: 'ae-form' },
      el('label', {}, el('span', { text: 'Votre réponse' }), reply), sendReply, feedback);
    replyForm.onsubmit = async event => {
      event.preventDefault();
      if (sendReply.disabled || !replyForm.reportValidity() || !reply.value.trim()) return;
      sendReply.disabled = reply.disabled = true;
      try {
        const result = await apiRequest(`/support/tickets/${encodeURIComponent(ticket.id)}/messages`, {
          method: 'POST', body: { body: reply.value.trim() },
        });
        if (!result?.id) throw Error('La réponse n’a pas été confirmée.');
        await load(ticket.id);
      } catch (error) { accountError(feedback, error); }
      finally { sendReply.disabled = reply.disabled = false; }
    };
    const details = el('details', { 'data-ticket': ticket.id },
      el('summary', { text: ticket.subject }),
      el('p', { text: `${supportStatuses[ticket.status] || ticket.status} · ${formatDateTime(ticket.updatedAt)}` }),
      el('div', {}, ...(ticket.messages || []).map(message => el('article', { class: 'ae-section' },
        el('small', { text: `${message.senderUserId === ticket.userId ? 'Vous' : 'Support Péncmi'} · ${formatDateTime(message.createdAt)}` }),
        el('p', { text: message.body })))),
      supportWritable.includes(ticket.status) ? replyForm : null);
    return el('article', { class: 'ae-session' }, details);
  }
  async function load(openId) {
    tickets.replaceChildren(el("p", { text: "Chargement de vos demandes…" }));
    try {
      const rows = await apiRequest("/support/tickets");
      tickets.replaceChildren(
        el("h2", { text: "Vos dernières demandes" }),
        rows.length
          ? el(
              "div",
              { class: "ae-sessions" },
              rows
                .slice(0, 20)
                .map(ticket => {
                  const card = ticketCard(ticket);
                  card.querySelector('details').open = ticket.id === openId;
                  return card;
                }),
            )
          : el("p", {
              text: "Vous n’avez aucune demande de support pour le moment.",
            }),
      );
    } catch (error) {
      accountError(tickets, error, () => load(openId));
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
      await load(result.id);
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
