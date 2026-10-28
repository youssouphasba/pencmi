if (!new URLSearchParams(location.search).get('id')) {
  document.querySelector('#publish-page').textContent = 'Annonce introuvable.';
} else {
  const script = document.createElement('script');
  script.src = new URL('../../../../publier/publish.js', document.currentScript.src).href;
  document.body.append(script);
}
