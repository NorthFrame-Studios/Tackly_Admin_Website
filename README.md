# Tackly Admin

Separat administrations- og moderationsapp til Tacklys danske peer-to-peer-markedsplads for hesteudstyr. Appen er beregnet til `admin.equilo.dk` og bruger samme Supabase-projekt som Tacklys Expo/React Native-app.

## Funktioner

- Sikkert Supabase Auth-login uden offentlig registrering
- Rollebaseret adgang for `moderator` og `admin`
- Oversigt med virkelige markeds- og moderationsmålinger
- Filtrerbare anmeldelser, annoncer, brugere og auditlog
- Detaljerede sagsforløb med billeder, beskeder, historik og interne noter
- Komplet chatkontekst ved samtaleanmeldelser, inklusive tydelig markering af den anmeldte besked
- Fælles supportindbakke med beskedtråde, interne noter, tildeling, prioritet og status
- Beskyttede handlinger til afvisning, billedskjulning, annoncefjernelse, advarsler, suspension, udelukkelse og rolleændring
- Responsive desktop-, tablet- og mobilvisninger
- Danske tekster, tilgængelige dialoger, tastaturnavigation samt loading-, fejl- og tomtilstande
- SPA-rewrite til Vercel

## Teknologi

React 19, TypeScript, Vite, React Router, Supabase JavaScript Client, Lucide React, Radix Dialog, CSS, ESLint, Vitest og React Testing Library.

## Lokal opsætning

Krav: en vedligeholdt Node.js LTS-version og npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

På Windows kan `.env.example` kopieres manuelt til `.env.local`.

Miljøvariabler:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable-eller-anon-key>
```

Brug URL og publishable/anon key fra mobilappens `EXPO_PUBLIC_SUPABASE_URL` og `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Variabelnavnene er forskellige, men værdierne skal pege på samme projekt. En service-role key må aldrig bruges i Vite eller Vercel.

Ved lokal udvikling accepterer Vite-konfigurationen også de eksisterende `EXPO_PUBLIC_*`-navne som kompatibilitetsfallback. Vercel og nye installationer bør bruge `VITE_*`-navnene ovenfor.

## Supabase-migrationer

Migrationerne ligger i [supabase/migrations](./supabase/migrations) og skal køres i filnavnsrækkefølge:

1. `20260803100000_admin_core_schema.sql` – roller, kontostatus, rapporter, moderation, billedstatus og indekser.
2. `20260803101000_admin_security_rls.sql` – rollehelpers, kolonnebeskyttelse, RLS, write guards og uforanderlig auditlog.
3. `20260803102000_admin_rpc_and_audit.sql` – beskyttede læse-RPC'er og den atomiske moderations-RPC.
4. `20260803103000_fix_admin_user_count_ambiguity.sql` – kvalificerer en tvetydig resultatkolonne i bruger-RPC'en.
5. `20260803104000_support_and_conversation_reports.sql` – supportsager, supportbeskeder, uforanderlig sagslog, samtalekontekst på anmeldelser, RLS og beskyttede support-RPC'er.

De kan køres via Supabase Dashboardens SQL Editor eller et linket Supabase CLI-projekt. Tag altid backup, gennemgå migrationerne mod produktionsschemaet og afprøv dem i staging først.

Eksempel med CLI fra et Supabase-projekt, der er linket til den rigtige project ref:

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push
```

Migrationerne sletter ingen annoncer eller moderationshistorik. Annoncens eksisterende statuscheck udvides med moderationsstatusser, og skjulte billeder filtreres med en restriktiv RLS-policy.

## Opret den første administrator sikkert

Kontoen skal først oprettes i Supabase Auth gennem en betroet proces. Kør derefter følgende i Supabase Dashboardens SQL Editor som databaseadministrator efter migrationerne. Kontrollér den fundne bruger-ID før commit i produktion.

```sql
begin;

update public.profiles
set role = 'admin', account_status = 'active'
where id = (
  select id from auth.users where lower(email) = lower('admin@equilo.dk')
);

commit;
```

E-mailadressen giver ikke adgang i sig selv. Adgang afgøres af `profiles.role`, `profiles.account_status`, RLS og beskyttede funktioner. Der findes ingen frontend-funktion til at oprette den første administrator.

## Kommandoer

```bash
npm run dev          # lokal udviklingsserver
npm run typecheck    # streng TypeScript-kontrol
npm run lint         # ESLint
npm test             # testpakken én gang
npm run test:watch   # interaktiv testkørsel
npm run build        # TypeScript + optimeret produktions-build
npm run preview      # lokal preview af dist/
```

## Vercel og admin.equilo.dk

1. Opret et nyt Vercel-projekt med denne mappe som root directory.
2. Vælg Vite-presettet. Build command er `npm run build`, og output directory er `dist`.
3. Tilføj `VITE_SUPABASE_URL` og `VITE_SUPABASE_ANON_KEY` som Production/Preview environment variables.
4. Deploy og kontrollér login samt direkte refresh på detaljeruter.
5. Tilføj `admin.equilo.dk` under projektets Domains.
6. Opret præcis den DNS-record, Vercel viser hos Tacklys DNS-udbyder. DNS ændres ikke af dette projekt.
7. Kontrollér HTTPS, Supabase Auths tilladte site/redirect URLs og logout efter DNS er aktiv.

`vercel.json` sender direkte requests som `/reports/:reportId`, `/users/:userId` og `/listings/:listingId` til SPA-entrypointet.

## Sikkerhedsmodel

- Frontend bruger kun publishable/anon key og en autentificeret brugers JWT.
- `get_my_admin_profile` afviser alle andre end aktive moderatorer og administratorer.
- Rapportdata og interne noter er staff-only via RLS/beskyttede RPC'er.
- Hele markedssamtaler kan læses af staff til moderationsformål; normale brugere kan fortsat kun læse samtaler, de selv deltager i.
- Support oprettes og besvares gennem beskyttede RPC'er. Brugere kan kun se egne sager og aldrig interne noter eller sagslog.
- Følsomme profilkolonner kan ikke læses eller ændres direkte af almindelige brugere.
- Alle mutationer går gennem `perform_moderation_action`, som verificerer rolle, validerer input, ændrer data og skriver auditpost i samme transaktion.
- Suspension, udelukkelse og rolleændring kræver administratorrolle.
- Den sidste aktive administrator kan ikke degraderes. En administrator kan ikke suspendere eller udelukke sig selv, og en admin skal degraderes før udelukkelse.
- Auditposter kan ikke opdateres eller slettes, heller ikke fra frontend.
- Suspenderede og udelukkede konti afvises ved writes til centrale markedspladstabeller.
- Knapper skjules efter rolle for brugeroplevelsen, men databasen er den autoritative sikkerhedsgrænse.

Kør Supabase Security Advisor og gennemgå eksisterende policies efter migration i staging. Rotér nøgler ved mistanke om læk; en service-role key må aldrig placeres i klientmiljøet.

## Tilpasning til det eksisterende Tackly-schema

Workspace-gennemgangen fandt mobilappen i søsterprojektet `ridegrej` og verificerede det aktive REST-schema med den eksisterende publishable key.

- `profiles` bruger `display_name`; der findes ikke et separat `username`-felt.
- E-mail ligger i `auth.users`, ikke `profiles`, og udleveres kun gennem staff-beskyttede RPC'er.
- `listings.status` havde `active`, `reserved`, `sold` og `archived`; migrationen bevarer dem og tilføjer moderationsstatusser.
- Billeder ligger i `listing_images` med `storage_path`. `moderation_status` er tilføjet, og RLS skjuler modererede billeder fra normale forespørgsler.
- Mobilappen skriver allerede bruger- og annonceanmeldelser til `reports`. Den skal sende `conversation_id` ved chatanmeldelser for at bevare hele samtalekonteksten; ældre beskedrapporter findes fortsat via `message_id`.
- Der fandtes ikke et supportticketsystem. Migration `104000` tilføjer det uden at ændre eksisterende markedsdata; mobilappen skal skifte fra `mailto:` til de nye support-RPC'er, før brugere kan oprette sager i adminindbakken.
- “Seneste aktivitet” bruger Supabase Auths `last_sign_in_at`, fordi schemaet ikke har et samlet aktivitetsfelt.
- Ingen genererede Supabase TypeScript-typer fandtes. Lokale interfaces følger de verificerede tabeller og migrationsfelter.

## Kendte begrænsninger

- Migrationerne er leveret, men køres bevidst ikke automatisk mod produktionsdatabasen.
- Eksisterende e-mailanmeldelser importeres ikke automatisk til `reports`.
- Eksisterende supportmails importeres ikke automatisk til `support_cases`.
- Support og samtalekontekst kræver den beskrevne mobilapp-integration; adminappen er klar til dataene, men dette repository ændrer ikke søsterprojektet automatisk.
- Brugere får en struktureret advarselspost i `user_warnings`; mobilappen viser den først, når den senere integrerer tabellen.
- De fælles begrundelsesskabeloner er read-only systemforslag. Ændringer kræver en versionsstyret kodeændring.
- `listing-images` er i mobilappen en offentlig Storage bucket. Billedmoderation er derfor en logisk skjulning i alle databasebaserede visninger; en allerede kendt offentlig fil-URL tilbagekaldes ikke. Fuld URL-tilbagekaldelse kræver en separat migrering til private objekter/signerede URL'er i både mobil- og admin-app.
- React Router bruges kun som klient-SPA. npm kan rapportere en RSC-mode advisory for den aktuelle pakkeversion; appen bruger hverken React Server Components, server actions eller React Router SSR.
