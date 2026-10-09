"use client";

import Script from "next/script";

const DEFAULT_GTM_ID = "GTM-MXLSDTJM";

function resolvedGtmId() {
  const configured = process.env.NEXT_PUBLIC_GTM_ID?.trim();
  if (configured && /^GTM-[A-Z0-9]+$/.test(configured)) {
    return configured;
  }
  return DEFAULT_GTM_ID;
}

export function GoogleTagManager() {
  const gtmId = resolvedGtmId();

  return (
    <>
      <Script id="shark-google-tag-manager" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          window.dataLayer.push({
            'gtm.start': new Date().getTime(),
            event: 'gtm.js'
          });
          (function(w,d,s,l,i){
            var f=d.getElementsByTagName(s)[0],
                j=d.createElement(s),
                dl=l!='dataLayer'?'&l='+l:'';
            j.async=true;
            j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;
            f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','${gtmId}');
        `}
      </Script>
      <noscript>
        <iframe
          src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
          height="0"
          width="0"
          style={{ display: "none", visibility: "hidden" }}
          title="Google Tag Manager"
        />
      </noscript>
    </>
  );
}
