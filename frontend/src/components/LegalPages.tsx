import type { ReactNode } from 'react'

const CONTACT = 'gokulkrishnanu019@gmail.com'
const UPDATED = 'October 2026'

function Page({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto min-h-full max-w-[680px] px-6 py-10 leading-relaxed text-[#2a2a31]" style={{ fontFamily: 'var(--font-ui)' }}>
      <a href="/" className="text-[14px] font-bold text-neutral-500 no-underline">← Memory Tale</a>
      <h1 className="mb-1 mt-4 text-[32px] font-extrabold leading-tight">{title}</h1>
      <p className="mt-0 text-[13px] text-neutral-500">Last updated {UPDATED}</p>
      <div className="space-y-5 text-[15.5px]">{children}</div>
    </main>
  )
}
const H = ({ children }: { children: ReactNode }) => <h2 className="mb-0 mt-8 text-[19px] font-extrabold">{children}</h2>

export function PrivacyPage() {
  return (
    <Page title="Privacy Policy">
      <p>Memory Tale is a scrapbook app for keeping and sharing photo memories with people you choose. This page explains what it stores and why.</p>
      <H>What we collect</H>
      <ul className="m-0 space-y-2 pl-5">
        <li><b>Your Google account basics:</b> name, email address and profile photo, when you sign in with Google. They are used to show who you are in a book and on invites.</li>
        <li><b>What you add:</b> books, photos, text, stickers, drawings and locations you place on a canvas.</li>
        <li><b>Your original photos,</b> if you connect Google Drive (see below).</li>
      </ul>
      <H>Where it is stored</H>
      <ul className="m-0 space-y-2 pl-5">
        <li>On your own device (in the browser or installed app), so the app works offline.</li>
        <li>In our cloud database (Google Firebase) when you are signed in, so your books sync across your devices and can be shared with people you invite. Photos there are smaller copies, not your originals.</li>
        <li>In <b>your own Google Drive</b>, if you choose to connect it: full-quality originals are saved in a folder called &quot;Memory Tale&quot;.</li>
      </ul>
      <H>Google Drive access</H>
      <p>If you connect Google Drive, Memory Tale asks only for the <code>drive.file</code> permission. It lets the app see and manage <b>only the files it creates itself</b>. It cannot read, list or change any other file in your Drive. Original photos are marked &quot;anyone with the link can view&quot; using a long random link, so that other members of a shared book can fetch a copy into their own Drive. You can disconnect Drive at any time in Settings and delete the folder from your Drive.</p>
      <H>Sharing</H>
      <p>A book is visible only to the people in it. When you share a book, the app creates a unique invite link. Anyone who opens the link can see a preview of the book (its title, cover and the people in it) and, after signing in, join it and edit it. People in a book can see the photos and the names and profile photos of the other members.</p>
      <H>Other services</H>
      <p>Place search and routes use OpenStreetMap services. Map pictures are loaded from OpenStreetMap. Sign-in, database and hosting are provided by Google Firebase and Vercel. We do not sell your data and we do not show ads.</p>
      <H>Your choices</H>
      <ul className="m-0 space-y-2 pl-5">
        <li>Delete a photo or a whole book at any time. Deleting a book you own removes it for everyone in it.</li>
        <li>Leave a book someone shared with you; it disappears from your shelf and the others keep it.</li>
        <li>Disconnect Google Drive in Settings, and remove the app&apos;s access in your Google Account permissions.</li>
        <li>To have your account data removed, email <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</li>
      </ul>
      <H>Contact</H>
      <p>Questions: <a href={`mailto:${CONTACT}`}>{CONTACT}</a></p>
    </Page>
  )
}

export function TermsPage() {
  return (
    <Page title="Terms of Service">
      <p>By using Memory Tale you agree to these simple terms.</p>
      <H>Your content</H>
      <p>The photos, text and other things you add are yours. You give the app permission to store them and to show them to the people you share a book with, only to run the service.</p>
      <H>Be kind and lawful</H>
      <p>Only add content you have the right to share, and do not add anything illegal, hateful or that invades someone&apos;s privacy. We may remove content or accounts that break these rules.</p>
      <H>Sharing</H>
      <p>Anyone with an invite link can join the book it belongs to, so share links only with people you trust. You are responsible for what you share.</p>
      <H>The service</H>
      <p>Memory Tale is provided as is, without promises that it will always be available or error-free. Keep your own copy of anything precious: the app can sync and back up photos, but it is not a guaranteed archive. We may change or stop the service.</p>
      <H>Contact</H>
      <p><a href={`mailto:${CONTACT}`}>{CONTACT}</a></p>
    </Page>
  )
}

const LIBS: [string, string, string, string][] = [
  ['React and React DOM', '19', 'MIT', 'https://react.dev'],
  ['Framer Motion', '14', 'MIT', 'https://github.com/motiondivision/motion'],
  ['Dexie', '4', 'Apache-2.0', 'https://dexie.org'],
  ['Firebase JavaScript SDK', '12', 'Apache-2.0', 'https://firebase.google.com'],
  ['Supabase JavaScript client', '2', 'MIT', 'https://github.com/supabase/supabase-js'],
  ['ONNX Runtime Web', '1.30', 'MIT', 'https://github.com/microsoft/onnxruntime'],
  ['Leaflet', '1.9', 'BSD-2-Clause', 'https://leafletjs.com'],
  ['html-to-image', '1.11', 'MIT', 'https://github.com/bubkoo/html-to-image'],
  ['fflate', '0.8', 'MIT', 'https://github.com/101arrowz/fflate'],
  ['Lucide icons', '1', 'ISC', 'https://lucide.dev'],
  ['canvas-confetti', '1.9', 'ISC', 'https://github.com/catdad/canvas-confetti'],
]

export function LicensesPage() {
  return (
    <Page title="Open-source notices">
      <p>Memory Tale is built with the open-source software and data below. Thank you to everyone who makes and shares it.</p>

      <H>Background removal (cut-out stickers)</H>
      <p>
        <b>U²-Net</b> (&quot;u2netp&quot;) by Xuebin Qin, Zichen Zhang, Chenyang Huang, Masood Dehghan, Osmar R. Zaiane and Martin Jagersand, from the paper
        &quot;U²-Net: Going Deeper with Nested U-Structure for Salient Object Detection&quot; (Pattern Recognition, 2020).
        Licensed under the <b>Apache License 2.0</b>. The ONNX file is the unmodified export distributed by the <b>rembg</b> project (MIT License, © 2020 Daniel Gatis).
        It runs on your device through <b>ONNX Runtime Web</b> (MIT, © Microsoft Corporation). Your photo is not uploaded anywhere.
      </p>
      <p className="text-[14px]">
        <a href="/models/LICENSE-U-2-Net.txt">Apache 2.0 licence text</a> · <a href="/models/NOTICE.txt">Model notice</a> · <a href="https://github.com/xuebinqin/U-2-Net">Source</a>
      </p>

      <H>Libraries</H>
      <ul className="m-0 list-none space-y-2 p-0">
        {LIBS.map(([name, v, lic, url]) => (
          <li key={name} className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-neutral-200 pb-2">
            <a href={url} className="font-bold">{name} <span className="font-normal text-neutral-500">v{v}</span></a>
            <span className="text-[13.5px] text-neutral-600">{lic}</span>
          </li>
        ))}
      </ul>
      <p className="text-[14px] text-neutral-600">Each library&apos;s full licence text is available from the link beside it.</p>

      <H>Maps and places</H>
      <p>Map data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>, available under the Open Database Licence (ODbL). Place search uses the Nominatim service and routes use the OSRM project&apos;s public server.</p>

      <H>Fonts</H>
      <p>Text fonts are served by Google Fonts under the SIL Open Font License or the Apache License 2.0: Manrope, Playfair Display, Dancing Script, Pacifico, Caveat, Permanent Marker, Bangers, Bebas Neue, Poppins, Special Elite, Comic Neue, Patrick Hand, Luckiest Guy and Gochi Hand.</p>

      <H>Emoji</H>
      <p>Emoji stickers use your device&apos;s own emoji font. Other stickers, frames, bubbles and icons are original artwork made for this app.</p>

      <p className="pt-4 text-[13px] text-neutral-500">Questions about these notices: <a href={`mailto:${CONTACT}`}>{CONTACT}</a></p>
    </Page>
  )
}
