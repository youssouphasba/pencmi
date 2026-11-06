import { apiRequest } from '../messaging/messaging-ui.mjs';
import {
  el,
  accountStyles,
  accountError,
  sessionRequired,
  profileImageUrl,
  roleLabels,
} from './account-ui.mjs';

export function mountAccountProfile(root) {
  accountStyles();
  let profile,
    busy = false,
    previewUrl;
  const revokePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  };
  window.addEventListener('pagehide', revokePreview, { once: true });
  async function load() {
    if (sessionRequired(root)) return;
    root.replaceChildren(
      el('p', { role: 'status', text: 'Chargement du profil…' }),
    );
    try {
      profile = await apiRequest('/users/me');
      draw();
    } catch (error) {
      accountError(root, error, load);
    }
  }
  function draw() {
    const feedback = el('div', { class: 'ae-feedback', role: 'status' });
    const imageBox = el('div', { class: 'ae-avatar' });
    const file = el('input', {
      type: 'file',
      name: 'avatarFile',
      accept: 'image/jpeg,image/png,image/webp',
    });
    const upload = el('button', {
      type: 'button',
      class: 'btn btn-primary',
      text: 'Téléverser la photo',
      disabled: true,
    });
    const remove = el('button', {
      type: 'button',
      class: 'btn btn-light',
      text: 'Supprimer la photo',
      disabled: !profile.avatarUrl,
    });
    const image = () => {
      const url = previewUrl || profileImageUrl(profile.avatarUrl);
      imageBox.replaceChildren(
        url
          ? el('img', {
              src: url,
              alt: 'Photo de profil',
              width: 128,
              height: 128,
              onError: () =>
                imageBox.replaceChildren(
                  el('span', { text: 'Photo indisponible' }),
                ),
            })
          : el('span', { text: 'Aucune photo' }),
      );
    };
    const profileForm = el('form', { class: 'ae-form' });
    const fields = Object.fromEntries(
      [
        ['firstName', 'Prénom', 100],
        ['lastName', 'Nom', 100],
        ['city', 'Ville', 150],
      ].map(([name, label, maxLength]) => {
        const input = el('input', {
          name,
          maxLength,
          value: profile[name] || '',
          autocomplete:
            name === 'firstName'
              ? 'given-name'
              : name === 'lastName'
                ? 'family-name'
                : 'address-level2',
        });
        profileForm.append(el('label', {}, el('span', { text: label }), input));
        return [name, input];
      }),
    );
    const save = el('button', {
      class: 'btn btn-primary',
      type: 'submit',
      text: 'Enregistrer les modifications',
    });
    profileForm.append(save);
    const controls = () => root.querySelectorAll('input, button');
    const working = (value) => {
      busy = value;
      controls().forEach((control) => {
        control.disabled = value;
      });
      if (!value) {
        upload.disabled = !file.files.length;
        remove.disabled = !profile.avatarUrl;
      }
    };
    const perform = async (work) => {
      if (busy) return;
      feedback.replaceChildren(el('p', { text: 'Enregistrement en cours…' }));
      working(true);
      try {
        await work();
      } catch (error) {
        accountError(feedback, error);
      } finally {
        working(false);
      }
    };
    file.addEventListener('change', () => {
      revokePreview();
      feedback.replaceChildren();
      const selected = file.files[0];
      if (
        selected &&
        (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type) ||
          selected.size > 5 * 1024 * 1024)
      ) {
        file.value = '';
        feedback.append(
          el('p', {
            role: 'alert',
            text: 'Choisissez une image JPEG, PNG ou WebP de 5 Mo maximum.',
          }),
        );
      } else if (selected) previewUrl = URL.createObjectURL(selected);
      upload.disabled = !file.files.length;
      image();
    });
    upload.onclick = () =>
      perform(async () => {
        const body = new FormData();
        body.append('file', file.files[0]);
        const result = await apiRequest('/users/me/avatar', {
          method: 'POST',
          body,
        });
        if (!result?.avatarUrl)
          throw new Error('Le téléversement n’a pas été confirmé.');
        profile.avatarUrl = result.avatarUrl;
        revokePreview();
        file.value = '';
        image();
        feedback.replaceChildren(
          el('p', { text: 'Votre photo a été mise à jour.' }),
        );
      });
    remove.onclick = () =>
      perform(async () => {
        const result = await apiRequest('/users/me/avatar', {
          method: 'DELETE',
        });
        if (!result?.removed)
          throw new Error('La suppression n’a pas été confirmée.');
        profile.avatarUrl = null;
        revokePreview();
        file.value = '';
        image();
        feedback.replaceChildren(
          el('p', { text: 'Votre photo a été supprimée.' }),
        );
      });
    profileForm.onsubmit = (event) => {
      event.preventDefault();
      if (!profileForm.reportValidity()) return;
      const body = Object.fromEntries(
        Object.entries(fields).map(([key, field]) => [
          key,
          field.value.trim() || null,
        ]),
      );
      void perform(async () => {
        profile = await apiRequest('/users/me', { method: 'PATCH', body });
        for (const [key, field] of Object.entries(fields))
          field.value = profile[key] || '';
        feedback.replaceChildren(
          el('p', { text: 'Votre profil a été mis à jour.' }),
        );
      });
    };
    const identity = el(
      'section',
      { class: 'ae-section' },
      el('h2', { text: 'Identifiants du compte' }),
      el(
        'dl',
        { class: 'ae-facts' },
        [
          ['Email', profile.email],
          ['Téléphone', profile.phone],
          ['Type de compte', roleLabels[profile.role] || profile.role],
        ].map(([label, value]) =>
          el(
            'div',
            {},
            el('dt', { text: label }),
            el('dd', { text: value || 'Non renseigné' }),
          ),
        ),
      ),
      el('p', {
        text: `${profile.emailVerified ? 'Email vérifié' : 'Email non vérifié'} · ${profile.phoneVerified ? 'Téléphone vérifié' : 'Téléphone non vérifié'}`,
      }),
      el('p', {
        class: 'pm-muted',
        text: 'La modification des identifiants et leur vérification ne sont pas disponibles pour le moment.',
      }),
    );
    root.replaceChildren(
      el(
        'section',
        { class: 'ae-section' },
        el('h2', { text: 'Informations personnelles' }),
        profileForm,
      ),
      el(
        'section',
        { class: 'ae-section' },
        el('h2', { text: 'Photo de profil' }),
        imageBox,
        el(
          'label',
          { class: 'ae-file' },
          el('span', {
            text: 'Nouvelle photo · JPEG, PNG, WebP · 5 Mo maximum',
          }),
          file,
        ),
        el('div', { class: 'ae-actions' }, upload, remove),
      ),
      identity,
      feedback,
    );
    image();
  }
  void load();
}
