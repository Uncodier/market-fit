export function createTrackingSnippet(siteId: string): string {
  const serializedSiteId = JSON.stringify(siteId).replace(/</g, "\\u003c")

  return `<script>
  (function() {
    window.Makinari = window.Makinari || {};
    window.Makinari.siteId = ${serializedSiteId};

    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://files.uncodie.com/tracking.min.js';
    script.onload = function() {
      if (typeof window.Makinari.init === 'function') {
        window.Makinari.init({
          siteId: ${serializedSiteId},
          debug: false
        });
      }
    };

    var firstScript = document.getElementsByTagName('script')[0];
    if (firstScript && firstScript.parentNode) {
      firstScript.parentNode.insertBefore(script, firstScript);
      return;
    }
    (document.head || document.body).appendChild(script);
  })();
</script>`;
}
