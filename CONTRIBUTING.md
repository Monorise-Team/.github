# Jak pracujemy w Monorise

Te zasady obowiązują we wszystkich repozytoriach organizacji `Monorise-Team`. Cały obieg zadania w jednym zdaniu:

```text
issue  ->  gałąź flow/<typ>/<numer>-<opis>  ->  PR do dev  ->  scalenie  ->  PR dev -> prod  ->  wydanie
```

| Gałąź | Do czego |
| --- | --- |
| `dev` (domyślna) | integracja: tu trafiają pull requesty zadań, po zielonym CI |
| `prod` | to, co wydane i wdrożone; zmienia się tylko przez pull request |
| `flow/<typ>/<numer>-<opis>` | jedno zadanie = jedno zgłoszenie = jedna gałąź, zawsze od aktualnego `dev` |
| `flow/hotfix/<numer>-<opis>` | pilna poprawka produkcji: od `prod`, pull request do `prod`, potem automat scala `prod` z powrotem do `dev` |

Repozytoria bez produkcji (`.github`, dokumentacja, szablony) mają `main` zamiast `dev` i `prod`; pull requesty idą do `main`.

## 1. Zaczynasz od zgłoszenia

Nie od kodu ani od gałęzi, tylko od zgłoszenia (issue) z formularza. Pustych zgłoszeń nie ma. Formularze:

| Formularz | Kiedy |
| --- | --- |
| 🐛 Zgłoszenie błędu | coś działa niepoprawnie |
| ✨ Nowa funkcja | nowa możliwość dla użytkownika |
| ♻️ Refaktor / wydajność | poprawa kształtu albo szybkości istniejącego kodu |
| 🔍 Spike / rozpoznanie | ograniczone czasowo śledztwo; efektem jest decyzja |
| 🔧 Utrzymanie | zależności, konfiguracja, build, narzędzia, testy |
| 📚 Dokumentacja | brakuje jej, jest błędna albo nieaktualna |
| 🔒 Utwardzanie bezpieczeństwa | hardening, **nie** dla żywych podatności |

> **Podatność, którą da się wykorzystać, nie idzie przez zgłoszenie.** Zgłoś ją prywatnie: [SECURITY.md](SECURITY.md).

Formularz od razu ustawia typ zgłoszenia, a automat dopisuje do tytułu typ i numer (`🐛 Bugfix: [009] Problem z załącznikami`), przy wyborze „Wydajność” lub „Testy” zmienia typ na `Performance` albo `Test`, nakłada etykiety `area:` z formularza, przypisuje autora, uzupełnia pola organizacji, relacje i milestone najbliższego wydania oraz dodaje kartę na tablicę „Monorise”.

### Pola zgłoszeń, zależności i polecenie `meta`

Każde zgłoszenie ma typ i zestaw pól organizacji (Issue types i Issue fields) oraz metadane w panelu bocznym:

| Pole | Wartości | Jak uzupełnia je automat |
| --- | --- | --- |
| Typ zgłoszenia | `✨ Feature`, `🐛 Bug`, `♻️ Refactor`, `⚡ Performance`, `🔧 Chore`, `📚 Docs`, `🧪 Test`, `🔒 Security`, `🔍 Spike` | ustawia formularz; automat zmienia `Refactor` → `Performance` („Wydajność”) i `Chore` → `Test` („Testy”) oraz uzupełnia brakujący typ (np. `Chore` w zgłoszeniach synchronizacji) |
| `🚦 Priority` | `🔥 Urgent`, `⏫ High`, `🔼 Medium`, `🔽 Low` | z sekcji „Priorytet” w formularzu: `P0-critical` → `Urgent`, `P1-high` → `High`, `P2-medium` → `Medium`, `P3-low` → `Low` |
| `💪 Effort` | `🐁 Low`, `🐕 Medium`, `🐘 High` | z sekcji „Nakład pracy”: `Mały` → `Low`, `Średni` → `Medium`, `Duży` → `High`; przy braku odpowiedzi `Medium` |
| `Start date` | data `YYYY-MM-DD` | gdy puste: dzień założenia zgłoszenia (strefa `Europe/Warsaw`); pilnuje tego też automat pull requestów przy zamykanym zgłoszeniu |
| `Target date` | data `YYYY-MM-DD` | gdy puste: dla otwartego `Start date` + 0 dni (`Low`), + 2 dni (`Medium`) albo + 7 dni (`High`); dla zamkniętego dzień zamknięcia |
| Milestone | najbliższe otwarte `vX.Y.Z` | gdy brak (zamknięte jako `not planned` nie dostają milestone) |

Typy, pola i opcje mają w organizacji emotki i kolory (`🐛 Bug`, `🚦 Priority`, `🔥 Urgent`, `🛫 Start date`, `🏁 Target date`). Automaty i polecenie `meta` porównują nazwy bez emotki na początku, więc ozdobniki można zmieniać w ustawieniach organizacji bez zmian w kodzie. Wyjątek: nazwy typów z emotką są wpisane w formularzach (`type:`) i w `ISSUE_TYPE_DISPLAY_NAMES` w `scripts/lib/issue-meta.mjs`, więc zmiana nazwy typu wymaga też zmiany tam.

Automat (`issue-automation.yml`) nie nadpisuje raz ustawionych dat, a `Priority`, `Effort` oraz typ dla „Wydajność”/„Testy” aktualizuje przy edycji treści zgłoszenia. W zgłoszeniach automatycznej synchronizacji (`sync-shared.yml`) ustawia typ `Chore`, `Priority: Low`, `Effort: Low` oraz `Start date` i `Target date` na bieżący dzień (gdy puste).

W sekcji **„Zależności”** wpisujesz relacje, po jednej linii na typ (wiele odwołań w jednej linii rozdziel przecinkami):

- `Czeka na:` — zgłoszenia blokujące (dodaje relację „blocked by”);
- `Część:` — większe zgłoszenie nadrzędne (dodaje bieżące zgłoszenie jako podzadanie).

Obsługiwane formaty odwołań (także między repozytoriami organizacji): `#12`, `Repo#12`, `Monorise-Team/Repo#12` oraz pełny adres URL zgłoszenia na GitHubie, np.:

```text
Czeka na: #12, MonoriseCore#13, https://github.com/Monorise-Team/AvenMail/issues/42
Część: Monorise-Team/MonoriseShared#4
```

Gdy czegoś brakuje (w starszych zgłoszeniach albo po założeniu zgłoszenia ręcznie bez formularza), uruchom w `Monorise-Team/.github`:

```bash
# Podgląd pełnego uzupełnienia (backfill) wszystkich zgłoszeń i pull requestów repozytorium:
node scripts/repo-setup.mjs meta MonoriseShared --dry-run

# Zapis pełnego uzupełnienia:
node scripts/repo-setup.mjs meta MonoriseShared

# Jedno zgłoszenie z ręcznymi wartościami i relacją:
node scripts/repo-setup.mjs meta MonoriseShared --issue 18 \
  --priority High --effort Medium --start 2026-11-24 --target 2026-11-26 \
  --blocked-by MonoriseCore#13 --parent #4
```

Bez `--issue` polecenie uzupełnia wstecz wszystkie otwarte i zamknięte zgłoszenia (pomijając boty poza zgłoszeniami synchronizacji) oraz pull requesty zamykające zgłoszenia (kopiuje brakujące etykiety `area:`, milestone i przypisuje autora). Z `--issue` pozwala jawnie nadpisać pola i dopisać relacje (`--blocked-by`, `--parent`).

**Gałąź w sekcji „Development”:** GitHub nie pozwala podpiąć pod zgłoszenie już istniejącej gałęzi przez API (`createLinkedBranch` tworzy wyłącznie nową gałąź). Żeby gałąź była widoczna w „Development”, załóż ją najpierw ze zgłoszenia:

```bash
gh issue develop <n> --base <base> --name flow/<typ>/<nnn>-<opis>
```

Przy delegowaniu zadania przez Relay Bridge utwórz lokalny `git worktree` tej gałęzi i przekaż go do zlecenia z `isolation: "in_place"`.

## 2. Typy, pola i etykiety

Nie używamy już etykiet `type:`, `prio:` ani `meta:` — ich rolę przejęły wbudowane funkcje GitHuba:

- **Typ zgłoszenia (Issue type)**: `✨ Feature` · `🐛 Bug` · `♻️ Refactor` · `⚡ Performance` · `🔧 Chore` · `📚 Docs` · `🧪 Test` · `🔒 Security` · `🔍 Spike` (ustawia formularz, a przy „Wydajność” i „Testy” poprawia automat).
- **Pola zgłoszeń (Issue fields)**: `Priority` (`Urgent` — produkcja leży albo dane są zagrożone, `High` — blokuje milestone, `Medium` — poczeka, `Low` — kosmetyka), `Effort` (`High`/`Medium`/`Low`), `Start date` i `Target date`. Priorytet żyje wyłącznie w polu `Priority`.
- **Pull requesty**: GitHub nie obsługuje typów ani pól na pull requestach — typ pull requestu wynika z nazwy gałęzi i tytułu, a priorytet i obszar ze zgłoszenia powiązanego przez `Closes #<numer>`. Na pull requeście zostają tylko etykiety `area:` oraz etykiety narzędziowe poniżej.
- **Etykiety, które zostają**:
  - **`area:`** (może być kilka): obszary repozytorium z `labels/repos.json`, np. `area: web`, `area: desktop`, `area: mobile`; kopiowane ze zgłoszenia na pull request.
  - **`dependencies`**: aktualizacje zależności (Renovate).
  - **`good first issue`** i **`help wanted`**: zadania na start dla nowej osoby albo otwarte do wzięcia z zewnątrz.
  - **`autorelease: pending`** i **`autorelease: tagged`**: zarządza nimi wyłącznie Release Please; polecenie `labels` nigdy ich nie tworzy ani nie usuwa, a wszystkie pozostałe zbędne etykiety usuwa.
- **Co zastępuje dawne etykiety `meta:`**:
  - zablokowane → relacja **„Blocked by”** (`Czeka na:` w formularzu albo `--blocked-by` w `meta`);
  - nie będzie robione / duplikat → powód zamknięcia zgłoszenia (**„not planned”** albo **„duplicate”**);
  - zmiana łamiąca zgodność → `!` w nagłówku Conventional Commits (albo stopka `BREAKING CHANGE:`), którą rozpoznaje Release Please;
  - wymaga dyskusji → wątek w [Dyskusjach organizacji](https://github.com/orgs/Monorise-Team/discussions);
  - brak triage → niepotrzebne, bo formularze wymagają typu, priorytetu i obszaru.

Do jednorazowego posprzątania starych etykiet ze zgłoszeń i pull requestów służy `node scripts/repo-setup.mjs migrate-labels <Repo|--all> [--dry-run]`, a do wyczyszczenia definicji etykiet w repozytorium — `node scripts/repo-setup.mjs labels <Repo> [--dry-run]`.

## 3. Gałąź

```text
flow/<typ>/<numer>-<krótki-opis>
flow/feature/004-snooze-threads
```

- **Typ**: `feature`, `bugfix`, `refactor`, `perf`, `chore`, `docs`, `security`, `spike`, `test`, a pilna poprawka produkcji `hotfix`.
- **Numer**: numer istniejącego zgłoszenia dopełniony zerami do trzech cyfr (#9 → `009`).
- **Opis**: po angielsku, małe litery, wyrazy łączone myślnikiem.

```bash
gh issue develop 4 --name "flow/feature/004-snooze-threads" --base dev
```

Automat pull requestów odrzuci gałąź o innej nazwie albo z numerem, który nie jest istniejącym zgłoszeniem. Wyjątki: `dev`, `prod`, `main` oraz gałęzie narzędzi `release-please--*`, `renovate/*` i `dependabot/*`.

## 4. Commit

[Conventional Commits](https://www.conventionalcommits.org/) po angielsku, nagłówek do 72 znaków. Z commitów Release Please liczy wersję i pisze historię zmian.

```text
feat(mail): show unread count per folder
fix(sync): keep the folder list after a reconnect
```

Typy: `feat`, `fix`, `refactor`, `perf`, `chore`, `docs`, `test`, `security`, `spike`, `ci`, `build`, `i18n`, `revert`. `feat!:` albo stopka `BREAKING CHANGE:` łamie zgodność. Hooki przed commitem sprawdzają formatowanie, lint i typy; `--no-verify` tylko w awarii.

## 5. Pull request

- Do `dev` (albo `main`), według szablonu, z `Closes #<numer>`.
- Sekcja **„Dla użytkowników”** po polsku i angielsku, prostym językiem; z niej powstaje opis wydania. „-”, gdy zmiany nie widać.
- Wystarczy wpisać sam opis: automat dokleja do tytułu typ i numer z nazwy gałęzi, etykiety `area:` i milestone ze zgłoszenia.
- Przed wysłaniem `pnpm check` na czystym drzewie roboczym.
- Scalamy zwykłym scaleniem (merge commit), **nigdy przez squash**.
- Kartę na tablicy przesuwasz do 🛠️ In Progress przy założeniu gałęzi i do 👀 Code Review przy otwarciu pull requestu; scalenie zamyka zgłoszenie i karta trafia do ✅ Done.

## 6. Wydania i wersje

- Wydanie to pull request `dev` → `prod` (`🚀 Release: dev → prod`).
- Release Please wylicza wersję SemVer z commitów, pisze `CHANGELOG.md` i tworzy oznaczenie `vX.Y.Z`. Wersji nie zmieniamy ręcznie; konkretną wymusza stopka `Release-As: X.Y.Z`.
- Milestone = wydanie (`v0.2.0`). Po wydaniu otwiera się następny.
- Wszystkie części produktu mają jedną wersję, a wszystkie paczki `@monorise-team/*` też jedną.

### Wdrożenia ([ADR-0097](https://github.com/Monorise-Team/MonoriseDocumentation/blob/main/adr/ADR-0097-on-demand-preview.md))

- **Produkcja** wdraża się tylko z `prod`, czyli po scaleniu pull requestu wydania. Środowisko „Production” w repozytorium.
- **Podgląd** (na Vercel „Preview”, na AWS staging) wdraża się tylko z gałęzi-wskaźnika `preview`. Przesuwa ją wyłącznie workflow `deploy-preview.yml`, zawsze do przodu do commita z `dev` i nigdy przez force push:
  - przy pull requeście wydania `dev → prod` (podgląd kandydata do wydania),
  - na żądanie: „Run workflow” w Actions albo `gh workflow run deploy-preview.yml -R Monorise-Team/<Repo>` (opcjonalnie `-f ref=<commit z dev>`),
  - po wypchnięciu oznaczenia `preview-<opis>` na commicie z `dev`.
- `dev`, `flow/*` i gałęzie automatów nie wdrażają się. Zmiany przed scaleniem sprawdzasz lokalnie i w CI.
- Na Vercel `vercel.json` włącza wdrożenia tylko dla `prod` i `preview` (`"git": { "deploymentEnabled": { "**": false, "prod": true, "preview": true } }`), a w projekcie są włączone wpisy wdrożeń na GitHubie. Wzór: MonoriseWebsite.
- Na `preview` nikt nie commituje ręcznie. Gdy automat zgłosi, że nie da się jej przesunąć do przodu, opiekun ustawia ją raz na `dev`.
- W nowym repozytorium pierwsze uruchomienie tylko zakłada `preview`: Vercel nie buduje samego utworzenia gałęzi, buduje każde kolejne przesunięcie (po nowym commicie na `dev`).
- Podglądy Vercel są chronione logowaniem: widzą je osoby z zespołu zalogowane do Vercel. Środowiska GitHub nie mają reguł gałęzi, bo Vercel zapisuje wdrożenia z pełnym SHA; pilnuje tego `vercel.json`.

## 7. Dyskusje

[Dyskusje organizacji](https://github.com/orgs/Monorise-Team/discussions) służą do rozmowy przed pracą i wokół niej. Są publiczne: bez sekretów, danych klientów i spraw firmowych.

| Co masz | Gdzie |
| --- | --- |
| konkretną pracę do zrobienia (błąd, funkcja, utrzymanie) | zgłoszenie z formularza w repozytorium |
| pytanie, jak coś działa | 🙏 Pytania i odpowiedzi (najlepszą odpowiedź oznaczamy) |
| propozycję techniczną przed decyzją | 🏛️ Architektura (RFC): problem, opcje, rekomendacja; przyjętą decyzję zapisuje ADR w MonoriseDocumentation |
| pomysł, który nie jest jeszcze zadaniem | 💡 Pomysły; gdy dojrzeje, powstaje zgłoszenie z odnośnikiem do dyskusji |
| uwagę o pracy z agentami AI, automatach i procesie | 🤖 Agenci AI i proces |
| podatność, którą da się wykorzystać | **nie dyskusja**: prywatnie według [SECURITY.md](SECURITY.md) |

Sekcje kategorii:

- **🏠 Monorise**: 📣 Ogłoszenia (wydania, zmiany procesu) i 🧭 Kierunek (plan prac); zakładają opiekunowie, komentować może każdy.
- **🛠️ Technika**: 🙏 Pytania i odpowiedzi, 🏛️ Architektura (RFC), 🤖 Agenci AI i proces.
- **👥 Społeczność**: 💡 Pomysły, 🙌 Pokazy, 🗳️ Ankiety, 💬 Rozmowy.

Kategorie „Architektura (RFC)” i „Pytania i odpowiedzi” mają formularze w `.github/DISCUSSION_TEMPLATE/` (nazwa pliku = adres kategorii). Kategorie i sekcje zmienia się tylko w ustawieniach Discussions na GitHubie; opis tutaj aktualizujemy razem z nimi. Gdy dyskusja kończy się zgłoszeniem albo ADR-em, w dyskusji zostaje odnośnik, a dyskusja zostaje zamknięta jako rozstrzygnięta.

## Agenci AI i wspólne pliki

Każde narzędzie AI (Claude, Gemini / Antigravity, ChatGPT / Codex, GitHub Copilot) czyta pliki z repozytorium, w którym pracuje. Żeby zasady się nie rozjeżdżały, jedno ich źródło żyje tutaj w `templates/agents/`, a skrypt `scripts/repo-setup.mjs` i codzienny workflow `.github/workflows/sync-shared.yml` rozsyłają je do każdego repozytorium organizacji.

### Co powstaje ze wzorca, a co pisze się ręcznie

| Plik w repozytorium | Pochodzenie |
| --- | --- |
| `AGENTS.md` (blok między `BEGIN:monorise-shared` i `END:monorise-shared`) | generowany z `templates/agents/shared.md` — zmieniaj wzorzec, nie ten blok |
| `AGENTS.md` (część poniżej bloku) | pisana ręcznie dla danego repozytorium (czym jest, polecenia, zasady kodu); synchronizacja zostawia ją bez zmian |
| `CLAUDE.md` | pisany ręcznie; musi zawierać odwołanie `@AGENTS.md` (gdy pliku albo odwołania brakuje, synchronizacja je dopisuje) |
| `GEMINI.md` | generowany z `templates/agents/GEMINI.md` |
| `.github/copilot-instructions.md` | generowany z `templates/agents/copilot-instructions.md` |
| `.github/workflows/sync-shared.yml` | generowany z `templates/agents/sync-shared.yml` (we wszystkich repozytoriach poza `.github`) |
| `.github/ISSUE_TEMPLATE/*` i `.github/pull_request_template.md` | generowane z `templates/` |

Cały plik `AGENTS.md` musi zmieścić się w limicie 12 000 znaków (limit jednego pliku w Antigravity) — skrypt kończy się błędem, gdy plik go przekroczy.

### Codzienna synchronizacja

Raz dziennie (oraz ręcznie poleceniem `dispatch`) workflow `.github/workflows/sync-shared.yml` w każdym repozytorium uruchamia `node scripts/repo-setup.mjs sync`:

- aktualizuje formularze, blok wspólnych zasad w `AGENTS.md` i pliki z manifestu;
- usuwa wycofane pliki, które mają znacznik `monorise:generated` w pierwszych 5 liniach, a zniknęły z manifestu;
- jeśli nic się nie zmieniło, kończy pracę;
- jeśli są zmiany, zakłada (albo wykorzystuje otwarte) zgłoszenie `🔧 Chore: [<numer>] Synchronizacja wspólnych plików z .github` oraz gałąź `flow/chore/<numer>-sync-shared-files`, otwiera pull request do gałęzi domyślnej i od razu go scala zwykłym merge commitem (treść wzorca przeszła już przegląd i CI tutaj, a pull requesty zakładane tokenem `GITHUB_TOKEN` nie uruchamiają CI). Gdy scalenie się nie uda, pull request zostaje otwarty z opisem powodu w podsumowaniu zadania.

### Jak zmienić wspólną zasadę albo dane „About”

1. Załóż zgłoszenie i pull request w `Monorise-Team/.github` (zmień wzorzec w `templates/agents/` albo wpis w `labels/repos.json`).
2. Po scaleniu pull requestu uruchom `node scripts/repo-setup.mjs dispatch`, żeby repozytoria dostały zmianę od razu (inaczej zadziała codzienna synchronizacja).
3. Przy zmianie opisu, strony albo tematów w `labels/repos.json` uruchom `node scripts/repo-setup.mjs about <Repo>` dla zmienionych repozytoriów.

### Audyt repozytoriów organizacji

Codzienny audyt w tym repozytorium (`node scripts/repo-setup.mjs audit`) porównuje repozytoria organizacji z `labels/repos.json`: wyłapuje brakujące wpisy, nieistniejące repozytoria, rozbieżności w opisie, stronie i tematach („About”), pozostałe stare etykiety `type:`/`prio:`/`meta:` oraz brak pliku `.github/workflows/sync-shared.yml` na gałęzi domyślnej. Gdy wykryje uwagi, otwiera albo aktualizuje jedno zgłoszenie `🔧 Chore: Audyt repozytoriów organizacji` (z typem `Chore` i priorytetem `Low`); gdy wszystko jest zgodne, zamyka je.

> Audyt w GitHub Actions działa z domyślnym tokenem `GITHUB_TOKEN`, który nie widzi repozytoriów prywatnych (np. `MonoriseDocumentation`). Wpisy z `"public": false` w `labels/repos.json` są wtedy pomijane po cichu — dla repozytoriów prywatnych uruchamiaj `audit` i `about` lokalnie z własnym zalogowanym `gh`.

### Lista kontrolna nowego repozytorium

1. Nazwę, przeznaczenie i strukturę ustala właściciel projektu.
2. W `Monorise-Team/.github` dodaj wpis w `labels/repos.json` (rodzaj, obszary, kontrole, opis, strona, tematy), a po scaleniu uruchom `node scripts/repo-setup.mjs` z poleceniami `labels`, `sync`, `about` i `protect`.
3. W nowym repozytorium uzupełnij część o repozytorium w `AGENTS.md` (czym jest, polecenia, zasady kodu), `CLAUDE.md` z `@AGENTS.md`, `README.md`, dostęp do potrzebnych paczek `@monorise-team/*` oraz `renovate.json`.
4. Jeśli repozytorium się wdraża: `vercel.json` albo wdrożenie na AWS i workflow `deploy-preview.yml` według punktu „Wdrożenia” (wzór: MonoriseWebsite), środowiska „Production” i „Preview” w repozytorium.
5. W `MonoriseDocumentation` dopisz repozytorium na liście repozytoriów i w karcie produktu.

## Wspólne pliki

To repozytorium (`Monorise-Team/.github`) trzyma wzorce: formularze (`templates/`), zasady i pliki agentów AI (`templates/agents/`), etykiety, dane „About” i ustawienia repozytoriów (`labels/`), automaty zgłoszeń, pull requestów i synchronizacji (`.github/workflows/`) oraz skrypt `scripts/repo-setup.mjs`, który rozsyła je do repozytoriów. Zmiana procesu to zmiana tutaj.
