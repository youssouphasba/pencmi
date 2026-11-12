import {
  apiRequest,
  formatDateTime,
  loginHref,
} from '../messaging/messaging-ui.mjs';
import { tokenSession } from '../auth/token-session.mjs';
import { mountEmailVerification } from './email-verification-settings.mjs';
import { mountAccountDeletion, mountBusinessEmailPreference } from './account-lifecycle-settings.mjs';
import {
  el,
  accountStyles,
  accountError,
  sessionRequired,
} from './account-ui.mjs';

export function mountAccountSettings(root) {
  accountStyles();
  if (sessionRequired(root)) return;
  const feedback = el('div', { role: 'status', class: 'ae-feedback' });
  const sessionBody = el('div');
  const verificationBody = el('div');
  const deletionBody = el('div');
  const businessEmailBody = el('div');
  const section = (title, ...children) =>
    el(
      'section',
      { class: 'ae-section' },
      el('h2', { text: title }),
      ...children,
    );
  const fields = Object.fromEntries(
    [
      ['currentPassword', 'Mot de passe actuel'],
      ['newPassword', 'Nouveau mot de passe'],
      ['confirmation', 'Confirmer le nouveau mot de passe'],
    ].map(([name, label]) => {
      const input = el('input', {
        type: 'password',
        name,
        required: true,
        autocomplete:
          name === 'currentPassword' ? 'current-password' : 'new-password',
        minLength: name === 'currentPassword' ? 1 : 12,
        maxLength: name === 'currentPassword' ? 1024 : 72,
      });
      return [
        name,
        { input, node: el('label', {}, el('span', { text: label }), input) },
      ];
    }),
  );
  let busy = false,
    page = 1;
  const submit = el('button', {
    class: 'btn btn-primary',
    type: 'submit',
    text: 'Changer le mot de passe',
  });
  const form = el(
    'form',
    { class: 'ae-form' },
    Object.values(fields).map((field) => field.node),
    el('p', {
      class: 'pm-muted',
      text: '12 caractères minimum, avec majuscule, minuscule, chiffre et symbole. Maximum 72 octets. Toutes les sessions seront déconnectées.',
    }),
    submit,
  );
  const requireLogin = (text) => {
    root.replaceChildren(
      el('p', { role: 'status', text }),
      el('a', {
        class: 'btn btn-primary',
        href: loginHref(),
        text: 'Se reconnecter',
      }),
    );
  };
  form.onsubmit = async (event) => {
    event.preventDefault();
    if (busy || sessionsBusy || !form.reportValidity()) return;
    if (fields.newPassword.input.value !== fields.confirmation.input.value) {
      feedback.replaceChildren(
        el('p', {
          role: 'alert',
          text: 'Les mots de passe ne correspondent pas.',
        }),
      );
      return;
    }
    const before = tokenSession.snapshot();
    const disabledStates = new Map(
      [...root.querySelectorAll('button, input')].map((input) => [
        input,
        input.disabled,
      ]),
    );
    busy = true;
    root.querySelectorAll('button, input').forEach((input) => {
      input.disabled = true;
    });
    feedback.replaceChildren(el('p', { text: 'Modification en cours…' }));
    try {
      const result = await apiRequest('/auth/change-password', {
        method: 'POST',
        body: {
          currentPassword: fields.currentPassword.input.value,
          newPassword: fields.newPassword.input.value,
        },
      });
      if (!result?.changed || !result.reauthenticationRequired)
        throw new Error('La modification n’a pas été confirmée.');
      await tokenSession.invalidate(before);
      form.reset();
      requireLogin('Votre mot de passe a été modifié. Reconnectez-vous.');
    } catch (error) {
      accountError(feedback, error);
    } finally {
      busy = false;
      disabledStates.forEach((disabled, input) => {
        if (input.isConnected) input.disabled = disabled;
      });
    }
  };
  let sessionsBusy = false;
  async function revoke(path, current = false) {
    if (busy || sessionsBusy) return;
    sessionsBusy = true;
    const before = tokenSession.snapshot();
    const disabledStates = new Map(
      [...sessionBody.querySelectorAll('button')].map((button) => [
        button,
        button.disabled,
      ]),
    );
    sessionBody.querySelectorAll('button').forEach((button) => {
      button.disabled = true;
    });
    try {
      const result = await apiRequest(path, { method: 'DELETE' });
      if (result?.revoked === undefined)
        throw new Error('La révocation n’a pas été confirmée.');
      if (current) {
        await tokenSession.invalidate(before);
        requireLogin('Cette session a été déconnectée.');
      } else {
        page = 1;
        await loadSessions();
      }
    } catch (error) {
      accountError(feedback, error);
    } finally {
      sessionsBusy = false;
      disabledStates.forEach((disabled, button) => {
        if (button.isConnected) button.disabled = disabled;
      });
    }
  }
  async function loadSessions() {
    sessionBody.replaceChildren(
      el('p', { role: 'status', text: 'Chargement des sessions…' }),
    );
    try {
      const result = await apiRequest(`/auth/sessions?page=${page}&limit=20`, {
        includeMeta: true,
      });
      sessionBody.replaceChildren(
        el(
          'div',
          { class: 'ae-sessions' },
          result.data.map((session) =>
            el(
              'article',
              { class: 'ae-session' },
              el('h3', {
                text: session.current ? 'Cet appareil' : session.device,
              }),
              el('p', {
                text: `Connexion : ${formatDateTime(session.createdAt)}`,
              }),
              session.lastUsedAt
                ? el('p', {
                    text: `Dernière activité : ${formatDateTime(session.lastUsedAt)}`,
                  })
                : null,
              el('button', {
                type: 'button',
                class: 'btn btn-light',
                text: session.current
                  ? 'Déconnecter cet appareil'
                  : 'Déconnecter cette session',
                onClick: () =>
                  revoke(
                    `/auth/sessions/${encodeURIComponent(session.id)}`,
                    session.current,
                  ),
              }),
            ),
          ),
        ),
        el('button', {
          class: 'btn btn-light',
          type: 'button',
          text: 'Déconnecter les autres appareils',
          disabled: result.meta?.total <= 1,
          onClick: () => revoke('/auth/sessions/others'),
        }),
      );
      if (result.meta?.totalPages > 1)
        sessionBody.append(
          el(
            'nav',
            { class: 'ae-actions', 'aria-label': 'Pages des sessions' },
            el('button', {
              type: 'button',
              class: 'btn btn-light',
              text: 'Précédent',
              disabled: page <= 1,
              onClick: () => {
                page--;
                void loadSessions();
              },
            }),
            el('span', { text: `Page ${page} sur ${result.meta.totalPages}` }),
            el('button', {
              type: 'button',
              class: 'btn btn-light',
              text: 'Suivant',
              disabled: page >= result.meta.totalPages,
              onClick: () => {
                page++;
                void loadSessions();
              },
            }),
          ),
        );
    } catch (error) {
      accountError(sessionBody, error, loadSessions);
    }
  }
  root.replaceChildren(
    section('Mot de passe', form),
    section('Adresse email', verificationBody),
    section('Sessions connectées', sessionBody),
    section(
      'Notifications et alertes',
      businessEmailBody,
      el(
        'div',
        { class: 'ae-actions' },
        el('a', {
          class: 'btn btn-light',
          href: '/compte/notifications/',
          text: 'Mes notifications',
        }),
        el('a', {
          class: 'btn btn-light',
          href: '/compte/alertes/',
          text: 'Gérer mes alertes',
        }),
      ),
      el('p', {
        text: 'Les notifications de sécurité et de suivi des demandes restent actives. La vérification par SMS est indisponible.',
      }),
    ),
    section(
      'Langue et confidentialité',
      el('p', { text: 'Langue de l’interface : français.' }),
      el('p', {
        text: 'Les coordonnées fournies dans une demande sont partagées avec l’annonceur concerné. Aucun réglage global de confidentialité n’est disponible pour le moment.',
      }),
    ),
    section('Suppression du compte', deletionBody),
    feedback,
  );
  void loadSessions();
  void mountEmailVerification(verificationBody);
  void mountBusinessEmailPreference(businessEmailBody);
  void mountAccountDeletion(deletionBody, () => requireLogin('Votre compte a été supprimé.'));
}
