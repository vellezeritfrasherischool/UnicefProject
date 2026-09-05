# MësoLehtë AI

**[English](#english-language) · [Shqip](#albanian-language)**

---

<a id="english-language"></a>
# English Language:

**Learning materials that adapt for every student.**

MësoLehtë AI is an educational platform for schools: the teacher uploads a difficult text, AI adapts it to students’ needs, and the teacher always stays in control — reviews, edits, and publishes.

**GitHub:** https://github.com/LedionRrahimi1/UnicefProject

Production documentation: [`docs/architecture.md`](docs/architecture.md),
[`docs/staging-deployment.md`](docs/staging-deployment.md),
[`docs/manual-qa-checklist.md`](docs/manual-qa-checklist.md), and
[`docs/school-handoff.md`](docs/school-handoff.md).

---

## The problem we solve

Many students struggle with classroom texts. One-size-fits-all materials leave some children behind. Teachers know this, but preparing individual versions takes too much time.

MësoLehtë shortens that time: **AI proposes, the teacher decides.**

We do not compare children against each other. Instead of “XP” and “badges”, the UI uses **Stars** and **Titles** — encouragement, not competition.

---

## Key features (what is worth showing)

### For the teacher
- Create material (paste text or upload a file)
- Choose the whole class or specific students
- **Adapt to each student’s needs** in one click (no one-by-one setup)
- Simplification levels, text length, number of quiz questions
- Generation options: summary, key points, vocabulary, quiz, EN translation, visualizations, teacher notes
- Full review before publishing (edit, approve, publish)
- **AI lesson chatbot** while reviewing a material (floating robot button → chat window)
- Class management and student preferences (visual, audio, reading level)
- Class analytics (completion, scores, who needs support)
- Manual rewards: Stars and Titles from the teacher

### For the student
- Assignments dashboard (pending / in progress / completed)
- Reading workspace with vocabulary, focus mode, font size and spacing
- AI explanation for a selected sentence
- **AI lesson chatbot** during reading (asks about the current lesson; off-topic questions are declined) — not shown on the quiz page
- **Listen** with real speech (Albanian and English TTS)
- AI figures / illustrations (especially for visual learners)
- SQ / EN reading when a translation exists
- Quiz with hints, feedback, and explanations on wrong answers
- Results + study plan + Memory Booster (flashcards, 1/3/7-day review)
- Flashcard practice
- Stars, levels, and titles

### Accessibility & language
- Accessibility panel (Lexend / Atkinson fonts, contrast, dark mode, motion)
- Bilingual UI: **Albanian / English** (including the AI chatbot labels and replies)
- Calm, classroom-friendly design

---

## How AI works — content adaptation

This is the core of the product. Below is the full AI flow for learning content.

### 1. Inputs: what AI receives

The teacher provides:
- the original text (from a book, PDF, or typed)
- title and subject
- simplification level (light / medium / advanced)
- desired length
- number of quiz questions
- which elements to generate (summary, vocabulary, quiz, EN, images…)

If **“Adapt to each student’s needs”** is enabled, the system also reads each selected student’s profile:
- reading level (Basic / Intermediate / Advanced)
- visual preference
- audio preference
- needs and preferred formats from the learning profile (if built from earlier quizzes)

### 2. Smart grouping (not 20 unnecessary versions)

Before calling AI many times, students are grouped by similar needs, e.g.:
- **Visual · Basic**
- **Visual**
- **Audio · Basic**
- **Basic**
- **Audio**
- **Advanced**
- **Standard** (intermediate)

Each group gets **one** adaptation. Students with the same needs share the same version. The teacher reviews a few variants, not one per name.

For each group, the system builds **learner hints** (pedagogical guidance), e.g.:
- “use figures and concrete examples”
- “short sentences, step by step”
- “clear text that works well when spoken aloud”
- “more detail and thinking questions” (for advanced)

These are **pedagogical** hints, not medical diagnoses.

### 3. Main adaptation call (`adaptMaterial`)

For each group, AI (OpenAI chat model) takes the text + parameters + hints and returns structured output:

| Output | Description |
|--------|-------------|
| **Simplified text** | Same content, language matched to the group level |
| **Summary** | Main idea in a few sentences |
| **Key points** | Short list for review |
| **Vocabulary** | Hard words + definition, synonym, example, EN translation |
| **Quiz** | Questions (multiple choice, yes/no, short answer, main idea) with hint and feedback |
| **Teacher notes** | What to watch for / how to support the class |
| **EN translation** | (optional) English version of the simplified text |
| **Visual prompts** | (optional) scene descriptions for image generation |

Simplification level can be **overridden automatically** per group (e.g. Basic → simpler; Advanced → more detail), even if the teacher chose a base level.

### 4. Figures (AI Images)

If visualizations are on (or the group is visual), AI Images generates a child-friendly educational illustration — simple, without unnecessary text in the image. The figure is stored with the material and shown in reading / quiz.

### 5. Storage and distribution

With **Supabase** enabled (`VITE_USE_SUPABASE=true`), adapted materials, assignments, **Stars (XP)**, **Titles (badges)**, learning profiles, post-quiz reports, flashcards, and Memory Booster packs are saved in the cloud database — not only in the browser. Teachers, classes, and students use **Supabase Auth** + tables (`materials`, `assignments`, `classes`, `students`, `profiles`, `xp_transactions`, `student_badges`, `learning_profiles`, `learning_reports`, `flashcards`, `memory_boosters`, `learning_events`).

Each adapted version is stored as a separate material with a label (e.g. `Photosynthesis (Visual · Basic)`), linked to that group’s students.

When the teacher **publishes**, assignments are created **only for the target students** of that version — and those students see them after login on any device (same project / env).

Rewards awarded by the teacher (Stars / Titles) sync via Supabase, so the student sees them after refresh on any browser.

Learning data after a quiz (**profile**, **report**, **Memory Booster**, **flashcards**, and reading **events**) is also stored in Supabase via `schema_learning.sql` — so it survives logout and works across devices.

### 6. AI during reading (after publishing)

While the student reads:
- **Vocabulary** — hard words open with definitions (from the adaptation)
- **Explain sentence** — student selects text → AI explains simply / gives an example / main idea / translates
- **TTS** — text is read aloud (Albanian or English), with volume and speed
- **Figure** — shown automatically for visual learners or on demand

### 6b. AI lesson chatbot (teacher review + student reading)

A floating **robot** button opens a chat window scoped to the current material.

| Who | Where | What it does |
|-----|--------|----------------|
| **Teacher** | Material review | Asks about clarity, vocabulary, quiz ideas, improvements for **this** material |
| **Student** | Reading workspace | Asks about the **current lesson** (and briefly prior lessons); refuses off-topic questions; does not hand over ready-made quiz answers |

- UI and chatbot copy are available in **Albanian and English** (follows the app language setting).
- Same chat thread for the open material; not shown on the quiz page.
- Uses the material text, summary, key points, and vocabulary as context for OpenAI chat.

### 7. AI in the quiz

- Hints and feedback from the initial adaptation
- On a wrong answer: AI gives an explanation + example (audio does not auto-play; the student presses **Listen** if wanted)
- Easier practice questions can be generated mid-quiz
- For visual learners: helper figures for the question / explanation

### 8. AI after the quiz — “learning that learns”

After completion, AI analyzes the session (without labeling the child with diagnoses) and produces:
- a supportive message for the student
- a short study plan
- an update to the **learning profile** (strengths, needs, preferred formats)
- **Memory Booster**: short summary, flashcards, review questions, 1 / 3 / 7-day schedule

That profile feeds future adaptations → the loop closes: **the more it is used, the more personalized the material becomes.**

With Supabase on, this post-quiz package is **saved in the cloud** (`learning_profiles`, `learning_reports`, `memory_boosters`, `flashcards`), not only in the browser.

### 9. Pedagogical principles AI follows

- Simple, warm language suited to school age
- Same scientific concept — not “dumbed down” incorrect content
- No medical diagnoses / clinical labeling
- The teacher can always edit or reject the AI draft

### Short flow diagram

```
Original text
    ↓
Select students + preferences
    ↓
Group by needs (Visual / Basic / Advanced / …)
    ↓
AI adapt per group  →  text + vocab + quiz + (EN) + (figures)
    ↓
Teacher reviews & publishes
    ↓
Student reads / listens / takes quiz
    ↓
AI profile + Memory Booster
    ↓
(hints for the next adaptation)
```

---

## How to demo

1. Register / log in as **teacher** (Login → Teacher tab), or use an existing teacher account  
2. **Classes** → create a class (note the join code) → add students, or let students register and join with the code  
3. **Create material** → paste text → choose class / students  
4. Keep **“Adapt to each student’s needs”** on → **Adapt with AI**  
5. Under **Materials** you will see the versions (labels: Visual, Basic, Advanced…)  
6. Open review → **Approve** → **Publish**  
7. Log out and log in as a **student** → open the assignment → read / listen → quiz → results  

**Data:** with Supabase on, the full demo is cloud-backed (teacher and student do **not** need the same browser): materials, assignments, Stars/Titles, learning profiles, reports, flashcards, and Memory Booster.

Run **all four** SQL files in order (see [Database setup](#database-setup-supabase) below), then set keys in `.env` (see `supabase/README.md`).

Offline / fallback: if `VITE_USE_SUPABASE=false`, the app uses browser `localStorage` only (same-browser demo).

---

## Database setup (Supabase)

In the Supabase Dashboard → **SQL Editor**, run these files **in order**:

| Order | File | What it creates |
|------:|------|-----------------|
| 1 | `supabase/schema.sql` | `materials`, `assignments`, base `profiles` |
| 2 | `supabase/schema_auth.sql` | Auth-ready `profiles`, `classes`, `students` |
| 3 | `supabase/schema_gamification.sql` | `xp_transactions` (Stars), `student_badges` (Titles) |
| 4 | `supabase/schema_learning.sql` | `learning_profiles`, `learning_reports`, `flashcards`, `memory_boosters`, `learning_events` |

Also: **Authentication → Providers → Email → disable “Confirm email”** so new accounts can log in immediately.

---

## Run locally

You need Node.js 18+ and a configured Supabase project. AI features additionally
require the authenticated Edge Function described in `supabase/functions/README.md`.

```bash
git clone https://github.com/LedionRrahimi1/UnicefProject.git
cd UnicefProject
npm install
cp .env.example .env
```

In `.env`:

```
VITE_USE_SUPABASE=true
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Run all four SQL scripts in order (see [Database setup](#database-setup-supabase)) before enabling the flag.

```bash
npm run dev
```

Open http://localhost:5173  

**Note:** `.env` is not pushed to GitHub. The OpenAI key is a server-only Supabase
secret named `OPENAI_API_KEY`; never put it in a `VITE_` variable.

---

## Stack

- React, TypeScript, Vite, Tailwind CSS  
- React Router, Radix UI, Recharts, Lucide  
- OpenAI: chat (`gpt-5.6-sol`), TTS (`gpt-4o-mini-tts`), Images (`gpt-image-1`)  
- **Supabase**: Auth + Postgres — materials, classes, students, Stars/Titles, and full learning cloud (profiles, reports, flashcards, Memory Booster, events)  
- Fallback: `localStorage` (`localDb.ts`) when `VITE_USE_SUPABASE=false`

---

## Limitations

- OpenAI key is in the frontend for the demo — production should use a server  
- Full PDF/Word text extraction is limited (pasting text works best)  
- MVP RLS policies are open for hackathon — tighten before production  
- No public hosting by default — run locally with `npm run dev` for the jury demo  

---

## Short structure

```
src/app/
  MaterialCreate.tsx      → create + personalized adaptation
  adaptationCohorts.ts    → grouping by needs
  MaterialReview.tsx      → review + publish
  ReadingWorkspace.tsx    → reading + TTS + figures
  Quiz.tsx / Results.tsx  → quiz + Memory Booster
  openai.ts               → adapt, TTS, images
  openaiLearning.ts       → profile + post-quiz reports
  services.ts             → app services (local or Supabase)
  supabase.ts / supabaseDb.ts
  localDb.ts              → localStorage fallback
supabase/
  schema.sql              → materials + assignments
  schema_auth.sql         → auth profiles, classes, students
  schema_gamification.sql → XP (stars) + student badges (titles)
  schema_learning.sql     → profiles, reports, flashcards, Memory Booster, events
```

---

## License

Hackathon / UNICEF project.  
Educational demo — MësoLehtë AI.

---

<a id="albanian-language"></a>
# Albanian Language:

# MësoLehtë AI

**Materiale mësimore që adaptohen për çdo nxënës.**

MësoLehtë AI është platformë edukative për shkolla: mësuesja ngarkon një tekst, AI e përshtat sipas nevojave të nxënësve, dhe mësuesja mbetet gjithmonë në kontroll — rishikon, ndryshon dhe publikon.

**GitHub:** https://github.com/LedionRrahimi1/UnicefProject

**[← English](#english-language)**

---

## Problemi që zgjidhim

Shumë nxënës e kanë të vështirë tekstin e klasës. Materiali i njëjtë për të gjithë lë disa fëmijë mbrapa. Mësuesit e dinë këtë, por përgatitja e versioneve individuale merr shumë kohë.

MësoLehtë e shkurton atë kohë: **AI propozon, mësuesja vendos.**

Ne nuk krahasojmë fëmijët me njëri-tjetrin. Në vend të “XP” dhe “badge”, në UI përdorim **Yje** dhe **Tituj** — inkurajim, jo konkurrencë.

---

## Features kryesore (çfarë ja vlen të shihet)

### Për mësuesen
- Krijim materiali (ngjit tekst ose ngarko skedar)
- Zgjedhje e klasës ose e nxënësve të caktuar
- **Adaptim sipas nevojave të secilit** me një klik (jo hyrje një nga një)
- Nivele thjeshtësimi, gjatësi teksti, numër pyetjesh
- Elementet e gjenerimit: përmbledhje, pika kryesore, fjalor, kuiz, përkthim EN, vizualizime, shënime për mësuesen
- Review i plotë para publikimit (editim, miratim, publikim)
- **Chatbot AI i mësimit** gjatë shqyrtimit të materialit (buton roboti → dritare bisede)
- Menaxhim klasash dhe preferenca nxënësish (vizual, audio, nivel leximi)
- Analytics për klasën (përfundim, rezultate, kush ka nevojë për mbështetje)
- Shpërblime manuale: Yje dhe Tituj nga mësuesja

### Për nxënësin
- Panel detyrash (në pritje / në vazhdim / të përfunduara)
- Hapësirë leximi me fjalor, focus mode, madhësi dhe hapësirë teksti
- Shpjegim i fjalisë së zgjedhur me AI
- **Chatbot AI i mësimit** gjatë leximit (pyet për mësimin aktual; tema jashtë mësimit refuzohen) — nuk shfaqet te faqja e kuizit
- **Dëgjo** me zë real (TTS shqip dhe anglisht)
- Figura / ilustrime AI (veçanërisht për nxënës vizualë)
- Lexim SQ / EN kur materiali ka përkthim
- Kuiz me hint, feedback dhe shpjegim te përgjigjja e gabuar
- Rezultate + plan studimi + Memory Booster (flashcards, përsëritje 1/3/7 ditë)
- Ushtrime me flashcards
- Yje, nivele dhe tituj

### Aksesueshmëri & gjuhë
- Panel aksesueshmërie (font Lexend / Atkinson, kontrast, dark mode, motion)
- UI dygjuhësh: **Shqip / English** (përfshi etiketat dhe përgjigjet e chatbot-it AI)
- Dizajn i qetë, i lexueshëm për klasë

---

## Si funksionon AI — adaptimi i përmbajtjes

Ky është zemra e produktit. Më poshtë është rrjedha e plotë e AI për përmbajtjen mësimore.

### 1. Hyrja: çfarë merr AI

Mësuesja jep:
- tekstin origjinal (nga libri, PDF, ose i shkruar)
- titullin dhe lëndën
- nivelin e thjeshtësimit (i lehtë / mesatar / i avancuar)
- gjatësinë e dëshiruar
- numrin e pyetjeve të kuizit
- cilat elemente të gjenerohen (përmbledhje, fjalor, kuiz, EN, figura…)

Nëse është e ndezur **“Adapto sipas nevojave të secilit”**, sistemi lexon edhe profilin e çdo nxënësi të zgjedhur:
- nivel leximi (Bazik / Mesatar / Avancuar)
- preferencë vizuale
- preferencë audio
- nevoja dhe formate nga profili mësimor (nëse ekziston nga kuizet e mëparshme)

### 2. Grupimi inteligjent (jo 20 versione të panevojshme)

Para se të thirret AI shumë herë, nxënësit grupohen sipas nevojave të ngjashme, p.sh.:
- **Vizual · Bazik**
- **Vizual**
- **Audio · Bazik**
- **Bazik**
- **Audio**
- **Avancuar**
- **Standard** (mesatar)

Secili grup merr **një** adaptim. Nxënësit me nevoja të njëjta ndajnë të njëjtin version. Kështu mësuesja rishikon pak variante, jo një për çdo emër.

Për çdo grup, sistemi ndërton **learner hints** (udhëzime pedagogjike), p.sh.:
- “përdor figura dhe shembuj konkretë”
- “fjali të shkurtra, hap pas hapi”
- “tekst i qartë për dëgjim”
- “më shumë detaje dhe pyetje që nxisin të menduarit” (për avancuar)

Këto janë udhëzime **pedagogjike**, jo diagnoza mjekësore.

### 3. Thirrja kryesore e adaptimit (`adaptMaterial`)

Për çdo grup, AI (model chat OpenAI) merr tekstin + parametrat + hints dhe kthen strukturuar:

| Output | Përshkrim |
|--------|-----------|
| **Tekst i thjeshtësuar** | I njëjti përmbajtje, gjuhë e përshtatur nivelit të grupit |
| **Përmbledhje** | Ideja kryesore në pak fjali |
| **Pikat kryesore** | Lista e shkurtër për ripërsëritje |
| **Fjalor** | Fjalë të vështira + përkufizim, sinonim, shembull, përkthim EN |
| **Kuiz** | Pyetje (multiple, po/jo, e shkurtër, ideja kryesore) me hint dhe feedback |
| **Shënime për mësuesen** | Çfarë të vëzhgojë / si ta mbështesë klasën |
| **Përkthim EN** | (opsionale) version anglisht i tekstit të thjeshtësuar |
| **Prompt-e vizuale** | (opsionale) përshkrime skenash për gjenerimin e figurave |

Niveli i thjeshtësimit mund të **mbishkruhet automatikisht** për grupin (p.sh. Bazik → më i thjeshtë; Avancuar → më i detajuar), edhe nëse mësuesja ka zgjedhur një nivel bazë.

### 4. Figura (AI Images)

Nëse vizualizimet janë të ndezura (ose grupi është vizual), AI Images gjeneron ilustrim edukativ për fëmijë — i thjeshtë, pa tekst të panevojshëm në figurë. Figura ruhet me materialin dhe shfaqet te leximi / kuizi.

### 5. Ruajtja dhe shpërndarja

Me **Supabase** aktiv (`VITE_USE_SUPABASE=true`), materialet e adapuara, detyrat, **Yjet (XP)**, **Titujt**, profili mësimor, raportet pas kuizit, flashcards dhe Memory Booster ruhen në databazën cloud — jo vetëm në browser. Mësuesit, klasat dhe nxënësit përdorin **Supabase Auth** + tabela (`materials`, `assignments`, `classes`, `students`, `profiles`, `xp_transactions`, `student_badges`, `learning_profiles`, `learning_reports`, `flashcards`, `memory_boosters`, `learning_events`).

Çdo version i adaptuar ruhet si material i veçantë me etiketë (p.sh. `Fotosinteza (Vizual · Bazik)`), i lidhur me nxënësit e atij grupi.

Kur mësuesja **publikon**, detyrat krijohen **vetëm për nxënësit e synuar** të atij versioni — dhe ata i shohin pas hyrjes nga çdo pajisje (i njëjti projekt / `.env`).

Shpërblimet (Yje / Tituj) sinkronizohen përmes Supabase — nxënësi i sheh pas rifreskimit në çdo browser.

Të dhënat e të nxënit pas kuizit (**profili**, **raporti**, **Memory Booster**, **flashcards** dhe **eventet** e leximit) ruhen gjithashtu në Supabase përmes `schema_learning.sql` — mbijetojnë pas daljes dhe funksionojnë në pajisje të ndryshme.

### 6. AI gjatë leximit (pas publikimit)

Ndërsa nxënësi lexon:
- **Fjalori** — fjalët e vështira hapen me përkufizim (nga adaptimi)
- **Shpjego fjali** — nxënësi zgjedh tekst → AI shpjegon thjeshtë / jep shembull / ideja kryesore / përkthen
- **TTS** — teksti lexohet me zë (shqip ose anglisht), me volum dhe shpejtësi
- **Figurë** — shfaqet automatikisht për vizualë ose kërkohet me buton

### 6b. Chatbot AI i mësimit (review i mësueses + leximi i nxënësit)

Butoni floating me ikonë **roboti** hap dritaren e bisedës, të kufizuar te materiali aktual.

| Kush | Ku | Çfarë bën |
|------|-----|-----------|
| **Mësuesja** | Shqyrtimi i materialit | Pyet për qartësi, fjalor, ide kuizi, përmirësime për **këtë** material |
| **Nxënësi** | Hapësira e leximit | Pyet për **mësimin aktual** (dhe shkurt mësimet e mëparshme); refuzon tema jashtë mësimit; nuk jep përgjigje të gatshme të kuizit |

- UI dhe teksti i chatbot-it janë në **shqip dhe anglisht** (ndjek gjuhën e aplikacionit).
- E njëjta bisedë për materialin e hapur; nuk shfaqet te faqja e kuizit.
- Përdor si kontekst tekstin e materialit, përmbledhjen, pikat kryesore dhe fjalorin (OpenAI chat).

### 7. AI në kuiz

- Hint dhe feedback nga adaptimi fillestar
- Te përgjigjja e gabuar: AI jep shpjegim + shembull (zëri nuk niset automatikisht; nxënësi shtyp **Dëgjo** nëse do)
- Mund të gjenerohen pyetje më të lehta praktikuese midis kuizit
- Për nxënës vizualë: figura ndihmëse për pyetjen / shpjegimin

### 8. AI pas kuizit — “mësimi që mëson”

Pas përfundimit, AI analizojnë sesionin (pa etiketuar fëmijën me diagnoza) dhe prodhon:
- mesazh mbështetës për nxënësin
- plan studimi të shkurtër
- përditësim të **profilit mësimor** (forca, nevoja, formate të preferuara)
- **Memory Booster**: përmbledhje e shkurtër, flashcards, pyetje ripërsëritjeje, orar 1 / 3 / 7 ditë

Ky profil përdoret në adaptimet e ardhshme → cikli mbyllet: **sa më shumë përdoret, aq më i personalizuar bëhet materiali**.

Me Supabase aktiv, ky paket pas kuizit **ruhet në cloud** (`learning_profiles`, `learning_reports`, `memory_boosters`, `flashcards`), jo vetëm në browser.

### 9. Parimet pedagogjike që ndjek AI

- Gjuha e thjeshtë, e ngrohtë, e përshtatshme për moshën shkollore
- I njëjti koncept shkencor — jo përmbajtje e gabuar “e lehtësuar”
- Jo diagnoza mjekësore / etiketim klinik
- Mësuesja gjithmonë mund të editojë dhe të refuzojë draftin e AI

### Skema e shkurtër e rrjedhës

```
Tekst origjinal
    ↓
Zgjedhje nxënësish + preferenca
    ↓
Grupim sipas nevojave (Vizual / Bazik / Avancuar / …)
    ↓
AI adaptim për çdo grup  →  tekst + fjalor + kuiz + (EN) + (figura)
    ↓
Mësuesja rishikon & publikon
    ↓
Nxënësi lexon / dëgjon / bën kuiz
    ↓
AI profil + Memory Booster
    ↓
(hints për adaptimin e radhës)
```

---

## Si të provohet (demo)

1. Regjistrohu / hyr si **mësuese** (Login → tab Mësuese), ose përdor një llogari mësueseje ekzistuese  
2. **Klasat** → krijo klasë (ruaj kodin) → shto nxënës, ose lejo nxënësit të regjistrohen dhe të bashkohen me kod  
3. **Krijo material** → ngjit tekst → zgjidh klasën / nxënësit  
4. Lë të ndezur **“Adapto sipas nevojave të secilit”** → **Adapto me AI**  
5. Te **Materialet** do të shohësh versionet (etiketa: Vizual, Bazik, Avancuar…)  
6. Hap review → **Mirato** → **Publiko**  
7. Dil dhe hyr si **nxënës** → hap detyrën → lexo / dëgjo → kuiz → rezultate  

**Të dhënat:** me Supabase aktiv, demo-ja e plotë është në cloud (mësuesja dhe nxënësi **nuk** duhet të jenë në të njëjtin browser): materiale, detyra, Yje/Tituj, profili mësimor, raportet, flashcards dhe Memory Booster.

Ekzekuto **katër** skedarët SQL me radhë (shih [Konfigurimi i databazës](#konfigurimi-i-databazës-supabase) më poshtë), pastaj vendos çelësat në `.env` (shih `supabase/README.md`).

Nëse `VITE_USE_SUPABASE=false`, app-i përdor vetëm `localStorage` (demo në të njëjtin browser).

---

## Konfigurimi i databazës (Supabase)

Në Supabase Dashboard → **SQL Editor**, ekzekuto këto skedarë **me radhë**:

| Radha | Skedari | Çfarë krijon |
|------:|---------|--------------|
| 1 | `supabase/schema.sql` | `materials`, `assignments`, `profiles` bazë |
| 2 | `supabase/schema_auth.sql` | `profiles` për Auth, `classes`, `students` |
| 3 | `supabase/schema_gamification.sql` | `xp_transactions` (Yje), `student_badges` (Tituj) |
| 4 | `supabase/schema_learning.sql` | `learning_profiles`, `learning_reports`, `flashcards`, `memory_boosters`, `learning_events` |

Gjithashtu: **Authentication → Providers → Email → çaktivizo “Confirm email”** që llogaritë e reja të hyjnë menjëherë.

---

## Si ta nisësh lokalisht

Duhet Node.js 18+ dhe një projekt Supabase i konfiguruar. Veçoritë AI kërkojnë
gjithashtu Edge Function të përshkruar te `supabase/functions/README.md`.

```bash
git clone https://github.com/LedionRrahimi1/UnicefProject.git
cd UnicefProject
npm install
cp .env.example .env
```

Në `.env`:

```
VITE_USE_SUPABASE=true
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Ekzekuto katër skriptet SQL me radhë (shih [Konfigurimi i databazës](#konfigurimi-i-databazës-supabase)) para se të aktivizosh flag-un.

```bash
npm run dev
```

Hape http://localhost:5173  

**Kujdes:** `.env` nuk shkon në GitHub. Çelësi OpenAI ruhet vetëm si secret
`OPENAI_API_KEY` në Supabase; mos e vendos kurrë në një variabël `VITE_`.

---

## Stack

- React, TypeScript, Vite, Tailwind CSS  
- React Router, Radix UI, Recharts, Lucide  
- OpenAI: chat (`gpt-5.6-sol`), TTS (`gpt-4o-mini-tts`), Images (`gpt-image-1`)  
- **Supabase**: Auth + Postgres — materiale, klasa, nxënës, Yje/Tituj, dhe cloud i plotë i të nxënit (profil, raporte, flashcards, Memory Booster, events)  
- Fallback: `localStorage` (`localDb.ts`) kur `VITE_USE_SUPABASE=false`

---

## Kufizimet 

- Çelësi OpenAI është në frontend për demo — në prodhim duhet server  
- Ngarkimi i PDF/Word si tekst i plotë është i kufizuar (më së miri ngjitja e tekstit)  
- Politikat RLS MVP janë të hapura për hackathon — shtrëngoji para prodhimit  
- Nuk ka hosting publik të paracaktuar — për jurisë: `npm run dev` lokalisht  

---

## Struktura e shkurtër

```
src/app/
  MaterialCreate.tsx      → krijimi + adaptimi personal
  adaptationCohorts.ts    → grupimi sipas nevojave
  MaterialReview.tsx      → rishikimi + publikimi
  ReadingWorkspace.tsx    → leximi + TTS + figura
  Quiz.tsx / Results.tsx  → kuiz + Memory Booster
  openai.ts               → adaptim, TTS, figura
  openaiLearning.ts       → profil + raporte pas kuizit
  services.ts             → shërbimet (local ose Supabase)
  supabase.ts / supabaseDb.ts
  localDb.ts              → fallback localStorage
supabase/
  schema.sql              → materials + assignments
  schema_auth.sql         → auth profiles, classes, students
  schema_gamification.sql → XP (yje) + student badges (tituj)
  schema_learning.sql     → profil, raporte, flashcards, Memory Booster, events
```

---

## License

Projekt për hackathon / UNICEF.  
Demo edukativ — MësoLehtë AI.

---
---
