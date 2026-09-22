# Prompt til Codex i Tackly-mobilappen

Kopiér hele prompten herunder til Codex, mens mobilappens repository `ridegrej` er åbent:

---

Implementér den resterende integration mellem Tackly-mobilappen og den eksisterende Tackly Admin-app. Inspicér hele mobilprojektet og dets Supabase-typer, services, routes og migrations før ændringer. Bevar eksisterende designmønstre og ændr ikke admin-repositoryet.

Admin-repositoryet har tilføjet migrationen `20260803104000_support_and_conversation_reports.sql` til samme Supabase-projekt. Den opretter følgende sikre backend-kontrakt:

- `reports.conversation_id uuid null references conversations(id)`
- En trigger udleder automatisk `conversation_id` fra `message_id` og afviser mismatch.
- RLS tillader kun en bruger at rapportere en samtale, som brugeren selv deltager i, og kun den anden deltager må være `reported_user_id`.
- `support_cases`: `id`, `user_id`, `subject`, `category`, `status`, `priority`, `assigned_admin_id`, `created_at`, `updated_at`, `last_message_at`, `resolved_at`.
- `support_messages`: `id`, `case_id`, `sender_id`, `body`, `is_internal`, `created_at`.
- Brugere kan via RLS kun læse egne supportsager og ikke-interne beskeder. Interne noter og support-eventloggen er staff-only.
- `create_support_case(p_category text, p_subject text, p_message text) returns uuid`
- `reply_to_support_case(p_case_id uuid, p_message text) returns uuid`
- Gyldige kategorier: `account`, `listing`, `trade`, `messages`, `technical`, `feedback`, `other`.
- Gyldige statusser: `new`, `open`, `waiting_for_user`, `resolved`, `closed`.

Udfør følgende:

1. Opdatér chatrapportering.
   - Find `src/services/reportService.ts` og `src/app/conversation/[id].tsx`.
   - Tilføj `conversationId` til den relevante TypeScript-inputtype og map den til kolonnen `conversation_id` i insertet til `reports`.
   - Send den aktuelle `conversationId`, når en konto rapporteres fra samtaleskærmen.
   - Bevar `listing_id` og `reported_user_id`; rapporten må aldrig kunne pege på den indloggede bruger som den anmeldte bruger.
   - Hvis UI'et understøtter rapportering af en bestemt besked, send også `message_id`. Ellers er `conversation_id` tilstrækkelig til, at moderator kan se hele tråden.
   - Autorisation må ikke baseres på frontend alene; stol på og håndtér fejl fra RLS.

2. Erstat e-mailbaseret support med supportsager i Supabase.
   - Bevar kategorierne og det eksisterende visuelle udtryk i `src/app/support.tsx` og `src/components/SupportCategorySelect.tsx`.
   - Erstat `mailto:`-flowet i `src/services/supportService.ts` med Supabase-kald til `create_support_case` og `reply_to_support_case`.
   - Supportformularen skal have kategori, emne og besked. Validér emne 3–160 tegn og første besked 10–5000 tegn, vis loading, dansk succesfeedback og forståelige fejl.
   - Opret ikke supportsager med direkte table inserts; brug RPC'erne, så ejerskab og audit sker atomisk.

3. Gør support til en komplet brugeroplevelse.
   - Vis brugerens egne supportsager sorteret efter `last_message_at desc` på supportskærmen eller en tydelig underroute.
   - Tilføj en detaljevisning med hele den offentlige beskedtråd, dansk statuslabel og mulighed for at svare på ikke-lukkede sager via `reply_to_support_case`.
   - Vis aldrig eller forespørg efter `is_internal = true` som en klientfunktion; RLS skal fortsat være sikkerhedsgrænsen.
   - Efter oprettelse skal brugeren kunne åbne den nye sag direkte. Efter svar skal tråden og status opdateres.
   - Understøt pull-to-refresh og gode loading-, tom-, offline- og fejltilstande. Brug ikke hardcodede sager.
   - Realtime er valgfrit; hvis projektets eksisterende realtime-mønster kan genbruges sikkert, opdatér tråden ved nye beskeder. Ellers er refresh ved fokus og pull-to-refresh tilstrækkeligt.

4. Typer og sikkerhed.
   - Genbrug projektets Supabase-klient og auth-session. Tilføj præcise lokale/generatede TypeScript-typer for de nye felter og tabeller uden `any`.
   - Brug kun appens publishable/anon key. Tilføj aldrig en service-role key.
   - En bruger må ikke kunne vælge `user_id`, `sender_id`, status, prioritet, tildelt medarbejder eller interne felter ved oprettelse/svar; backend udleder disse.
   - Bevar den eksisterende e-mailadresse som en lille nød-/kontaktmulighed, hvis det giver mening, men den primære supporthandling skal være Supabase-sagen.

5. Tests og dokumentation.
   - Tilføj meningsfulde tests for mapping af `conversation_id`, oprettelse af support, svar, validering og fejl fra RPC/RLS efter projektets eksisterende testmønster.
   - Opdatér dokumentation og eventuelle Supabase-typer.
   - Kør formattering, TypeScript, lint, tests og den relevante Expo/web build-kontrol. Ret alle fejl, der skyldes ændringerne.

Vigtige afgrænsninger:

- Opret ikke en parallel supporttabel eller nye RPC-navne.
- Ændr ikke adminfunktionernes kontrakt.
- De nødvendige databaseobjekter kommer fra adminmigrationen; hvis de ikke findes i den tilsluttede Supabase-instans, stop og oplys præcist, at migration `20260803104000_support_and_conversation_reports.sql` først skal anvendes.
- Modificér ikke eksisterende markeds-, chat- eller auth-adfærd ud over den beskrevne integration.
- Afslut først, når alle relevante checks passerer, og giv en kort liste over ændrede filer samt eventuelle manuelle Supabase-trin.

---
