/**
 * High-reliability print utility for AI Studio web apps.
 * Prints an HTML element directly using an isolated, off-screen iframe
 * to eliminate parent container overflow, modal clippings, and blank pages.
 */
export const printElement = (elementId: string, documentTitle: string = 'Report Card'): Promise<boolean> => {
  return new Promise((resolve) => {
    const printArea = document.getElementById(elementId);
    if (!printArea) {
      console.warn(`Element #${elementId} not found for printing, falling back to window.print()`);
      window.print();
      resolve(false);
      return;
    }

    try {
      // 1. Remove any previous print iframe
      const existingIframe = document.getElementById('applet-print-iframe');
      if (existingIframe) {
        existingIframe.remove();
      }

      // 2. Create off-screen iframe with actual positive dimensions
      // IMPORTANT: Do NOT use visibility:hidden or display:none or 0 width/height,
      // as Chrome/WebKit's print compositor marks 0x0 or visibility:hidden elements as non-drawable (causing blank pages).
      const iframe = document.createElement('iframe');
      iframe.id = 'applet-print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.top = '-9999px';
      iframe.style.left = '-9999px';
      iframe.style.width = '800px';
      iframe.style.height = '1150px';
      iframe.style.border = 'none';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      iframe.style.zIndex = '-9999';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentWindow?.document;
      if (!iframeDoc) {
        window.print();
        resolve(false);
        return;
      }

      // 3. Extract stylesheet links and style tags, stripping out any 'body * { visibility: hidden }' rules
      const linkTags = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
        .map(el => el.outerHTML)
        .join('\n');

      const styleTags = Array.from(document.querySelectorAll('style'))
        .map(el => {
          let css = el.innerHTML;
          // Strip out global visibility hidden rules that cause blank print pages inside isolated iframes
          css = css.replace(/body\s*\*\s*\{\s*visibility\s*:\s*hidden[^}]*\}/gi, '');
          return `<style>${css}</style>`;
        })
        .join('\n');

      // 4. Build complete document
      iframeDoc.open();
      iframeDoc.write(`
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="utf-8" />
            <title>${documentTitle}</title>
            ${linkTags}
            ${styleTags}
            <style>
              @page {
                size: A4 portrait;
                margin: 6mm;
              }
              *, *::before, *::after {
                box-sizing: border-box !important;
                visibility: visible !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              html, body {
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                color: #000000 !important;
                width: 100% !important;
                height: auto !important;
                min-height: 100% !important;
                overflow: visible !important;
                font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              }
              .standalone-print-root {
                width: 100% !important;
                max-width: 794px !important;
                margin: 0 auto !important;
                padding: 6px !important;
                background: #ffffff !important;
                display: block !important;
              }
              img {
                max-width: 100% !important;
                display: block;
              }
            </style>
          </head>
          <body>
            <div class="standalone-print-root">
              ${printArea.innerHTML}
            </div>
          </body>
        </html>
      `);
      iframeDoc.close();

      // 5. Ensure all images (logos, stamps, photos) are loaded before firing the print dialog
      const executePrint = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          resolve(true);
        } catch (err) {
          console.warn('Iframe print failed, falling back to window.print():', err);
          window.print();
          resolve(false);
        } finally {
          setTimeout(() => {
            iframe.remove();
          }, 15000);
        }
      };

      const images = Array.from(iframeDoc.images);
      if (images.length === 0) {
        setTimeout(executePrint, 200);
      } else {
        let loadedCount = 0;
        const total = images.length;
        const checkDone = () => {
          loadedCount++;
          if (loadedCount >= total) {
            setTimeout(executePrint, 150);
          }
        };

        images.forEach(img => {
          if (img.complete && img.naturalHeight !== 0) {
            checkDone();
          } else {
            img.onload = checkDone;
            img.onerror = checkDone;
          }
        });

        // Fail-safe timeout in case an external image fails to fire onload
        setTimeout(executePrint, 700);
      }
    } catch (e) {
      console.error('Error in printElement:', e);
      window.print();
      resolve(false);
    }
  });
};
