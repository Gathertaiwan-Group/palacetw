import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "../globals.css";
import { getIndex, setting } from "@/lib/data";
import { SITE_URL, SITE_NAME } from "@/lib/site";
import PixelPageView from "@/components/PixelPageView";
import ChatButton from "@/components/ChatButton";

export async function generateMetadata(): Promise<Metadata> {
  const ix = await getIndex();
  const icon = setting<{ url?: string }>(ix, "site_icon", {}).url;
  const tracking = setting<Record<string, string | null>>(ix, "tracking", {});
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: SITE_NAME, template: `%s` },
    icons: icon ? { icon: [{ url: icon, sizes: "32x32" }, { url: icon, sizes: "192x192" }], apple: icon } : undefined,
    other: {
      ...(tracking.facebook_domain_verification ? { "facebook-domain-verification": tracking.facebook_domain_verification } : {}),
      "msapplication-TileImage": icon || "",
    },
    alternates: { types: { "application/rss+xml": [{ url: "/feed/", title: `訂閱《${SITE_NAME}》&raquo; 資訊提供` }, { url: "/comments/feed/", title: `訂閱《${SITE_NAME}》&raquo; 留言的資訊提供` }] } },
  };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

/** Root layout of the public site (the admin has its own root layout in app/admin). No request APIs here: pages are ISR. */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const ix = await getIndex();
  const tracking = setting<Record<string, string | null>>(ix, "tracking", {});
  const pixel = tracking.facebook_pixel_id;
  const ga = tracking.ga || tracking.ga4 || null;
  const gtm = tracking.gtm || null;
  return (
    <html lang="zh-TW">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Lato:100,200,300,400,500,600,700,800,900,100i,200i,300i,400i,500i,600i,700i,800i,900i&subset=latin&display=swap" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Noto+Serif:400,700,400i,700i|Noto+Serif+TC:200,300,400,500,600,700,900&display=swap&subset=all" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Roboto:100,100italic,200,200italic,300,300italic,400,400italic,500,500italic,600,600italic,700,700italic,800,800italic,900,900italic%7CRoboto+Slab:100,200,300,400,500,600,700,800,900%7COpen+Sans:300,400,500,600,700,800&display=auto" />
        <link rel="stylesheet" href="/wp/theme.css" />
      </head>
      <body>
        {children}
        <ChatButton />
        {pixel ? (
          <>
            <Script id="fb-pixel" strategy="afterInteractive">{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixel}');`}</Script>
            <PixelPageView />
            <noscript><img height="1" width="1" style={{ display: "none" }} src={`https://www.facebook.com/tr?id=${pixel}&ev=PageView&noscript=1`} alt="facebook_pixel" /></noscript>
          </>
        ) : null}
        {gtm ? <Script id="gtm" strategy="afterInteractive">{`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtm}');`}</Script> : null}
        {ga ? <><Script src={`https://www.googletagmanager.com/gtag/js?id=${ga}`} strategy="afterInteractive" /><Script id="ga4" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${ga}');`}</Script></> : null}
      </body>
    </html>
  );
}
