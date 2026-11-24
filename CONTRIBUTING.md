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

Automat dopisuje do tytułu typ i numer (`🐛 Bugfix: [009] Problem z załącznikami`), nakłada etykiety z formularza, przypisuje autora, typ zgłoszenia, pola organizacji, relacje i milestone najbliższego wydania, a kartę dodaje na tablicę „Monorise”.

### Pola zgłoszeń, zależności i polecenie `meta`

Każde zgłoszenie ma zestaw pól organizacji (Issue fields) oraz metadanych w panelu bocznym:

| Pole | Wartości | Jak uzupełnia je automat |
| --- | --- | --- |
| `Priority` | `Urgent`, `High`, `Medium`, `Low` | z sekcji „Priorytet” albo etykiety `prio:`: `P0-critical` → `Urgent`, `P1-high` → `High`, `P2-medium` → `Medium`, `P3-low` → `Low` |
| `Effort` | `Low`, `Medium`, `High` | z sekcji „Nakład pracy”: `Mały` → `Low`, `Średni` → `Medium`, `Duży` → `High`; przy braku odpowiedzi `Medium` |
| `Start date` | data `YYYY-MM-DD` | gdy puste: dzień założenia zgłoszenia (strefa `Europe/Warsaw`); pilnuje tego też automat pull requestów przy zamykanym zgłoszeniu |
| `Target date` | data `YYYY-MM-DD` | gdy puste: dla otwartego `Start date` + 0 dni (`Low`), + 2 dni (`Medium`) albo + 7 dni (`High`); dla zamkniętego dzień zamknięcia |
| Typ zgłoszenia | `Bug`, `Feature`, `Task` | z etykiety `type:` (`bugfix` i `security` → `Bug`, `feature` → `Feature`, reszta → `Task`) |
| Milestone | najbliższe otwarte `vX.Y.Z` | gdy brak (zamknięte jako `not planned` nie dostają milestone) |

Automat (`issue-automation.yml`) nie nadpisuje raz ustawionych dat, a `Priority` i `Effort` aktualizuje przy edycji treści zgłoszenia. W zgłoszeniach automatycznej synchronizacji (`sync-shared.yml`) ustawia `Priority: Low`, `Effort: Low` oraz `Start date` i `Target date` na bieżący dzień (gdy puste).

W sekcji **„Zależności”** wpisujesz relacje, po jednej linii na typ (wiele odwołań w jednej linii rozdziel przecinkami):

- `Czeka na:` — zgłoszenia blokujące (dodaje relację „blocked by”);
- `Część:` — większe zgłoszenie nadrzędne (dodaje bieżące zgłoszenie jako podzadanie).

Obsługiwane formaty odwołań (także między repozytoriami organizacji): `#12`, `Repo#12`, `Monorise-Team/Repo#12` oraz pełny adres URL zgłoszenia na GitHubie, np.:

```text
Czeka na: #12, MonoriseCore#13, https://github.com/Monorise-Team/AvenMail/issues/42
Część: Monorise-Team/MonoriseShared#4
```

Gdy czegoś brakuje (w starszych zgłoszeniach, po założeniu zgłoszenia ręcznie bez formularza albo żeby powiązać gałąź utworzoną przez Relay Bridge zamiast `gh issue develop`), uruchom w `Monorise-Team/.github`:

```bash
# Podgląd pełnego uzupełnienia (backfill) wszystkich zgłoszeń i pull requestów repozytorium:
node scripts/repo-setup.mjs meta MonoriseShared --dry-run

# Zapis pełnego uzupełnienia:
node scripts/repo-setup.mjs meta MonoriseShared

# Jedno zgłoszenie z ręcznymi wartościami, relacją i powiązaniem istniejącej gałęzi:
node scripts/repo-setup.mjs meta MonoriseShared --issue 18 \
  --priority High --effort Medium --start 2026-11-24 --target 2026-11-26 \
  --blocked-by MonoriseCore#13 --parent #4 --branch flow/chore/018-przyklad
```

Bez `--issue` polecenie uzupełnia wstecz wszystkie otwarte i zamknięte zgłoszenia (pomijając boty poza zgłoszeniami synchronizacji) oraz pull requesty zamykające zgłoszenia (kopiuje brakujące etykiety `area:`/`prio:`, milestone i przypisuje autora). Z `--issue` pozwala jawnie nadpisać pola, dopisać relacje (`--blocked-by`, `--parent`) i powiązać istniejącą gałąź w sekcji „Development” (`--branch`, best-effort).

## 2. Etykiety

- **`type:`** (jedna): `✨ feature` · `🐛 bugfix` · `♻️ refactor` · `⚡ perf` · `🔧 chore` · `📚 docs` · `🧪 test` · `🔒 security` · `🔍 spike`
- **`area:`** (może być kilka): obszary repozytorium, np. `web`, `desktop`, `mobile`.
- **`prio:`**: `P0-critical` (produkcja leży albo dane są zagrożone) · `P1-high` (blokuje milestone) · `P2-medium` (poczeka) · `P3-low` (kosmetyka)
- **`meta:`**: `❓ needs triage` · `🚧 blocked` · `💬 needs discussion` · `💥 breaking change` · `🗑️ wontfix` · `♊ duplicate`

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
- Wystarczy wpisać sam opis: automat dokleja do tytułu typ i numer z nazwy gałęzi, etykiety i milestone.
- Przed wysłaniem `pnpm check` na czystym drzewie roboczym.
- Scalamy zwykłym scaleniem (merge commit), **nigdy przez squash**.
- Kartę na tablicy przesuwasz do 🛠️ In Progress przy założeniu gałęzi i do 👀 Code Review przy otwarciu pull requestu; scalenie zamyka zgłoszenie i karta trafia do ✅ Done.

## 6. Wydania i wersje

- Wydanie to pull request `dev` → `prod` (`🚀 Release: dev → prod`).
- Release Please wylicza wersję SemVer z commitów, pisze `CHANGELOG.md` i tworzy oznaczenie `vX.Y.Z`. Wersji nie zmieniamy ręcznie; konkretną wymusza stopka `Release-As: X.Y.Z`.
- Milestone = wydanie (`v0.2.0`). Po wydaniu otwiera się następny.
- Wszystkie części produktu mają jedną wersję, a wszystkie paczki `@monorise-team/*` też jedną.

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

Codzienny audyt w tym repozytorium (`node scripts/repo-setup.mjs audit`) porównuje repozytoria organizacji z `labels/repos.json`: wyłapuje brakujące wpisy, nieistniejące repozytoria, rozbieżności w opisie, stronie i tematach („About”) oraz brak pliku `.github/workflows/sync-shared.yml` na gałęzi domyślnej. Gdy wykryje uwagi, otwiera albo aktualizuje jedno zgłoszenie `🔧 Chore: Audyt repozytoriów organizacji`; gdy wszystko jest zgodne, zamyka je.

> Audyt w GitHub Actions działa z domyślnym tokenem `GITHUB_TOKEN`, który nie widzi repozytoriów prywatnych (np. `MonoriseDocumentation`). Wpisy z `"public": false` w `labels/repos.json` są wtedy pomijane po cichu — dla repozytoriów prywatnych uruchamiaj `audit` i `about` lokalnie z własnym zalogowanym `gh`.

### Lista kontrolna nowego repozytorium

1. Nazwę, przeznaczenie i strukturę ustala właściciel projektu.
2. W `Monorise-Team/.github` dodaj wpis w `labels/repos.json` (rodzaj, obszary, kontrole, opis, strona, tematy), a po scaleniu uruchom `node scripts/repo-setup.mjs` z poleceniami `labels`, `sync`, `about` i `protect`.
3. W nowym repozytorium uzupełnij część o repozytorium w `AGENTS.md` (czym jest, polecenia, zasady kodu), `CLAUDE.md` z `@AGENTS.md`, `README.md`, dostęp do potrzebnych paczek `@monorise-team/*` oraz `renovate.json`.
4. W `MonoriseDocumentation` dopisz repozytorium na liście repozytoriów i w karcie produktu.

## Wspólne pliki

To repozytorium (`Monorise-Team/.github`) trzyma wzorce: formularze (`templates/`), zasady i pliki agentów AI (`templates/agents/`), etykiety, dane „About” i ustawienia repozytoriów (`labels/`), automaty zgłoszeń, pull requestów i synchronizacji (`.github/workflows/`) oraz skrypt `scripts/repo-setup.mjs`, który rozsyła je do repozytoriów. Zmiana procesu to zmiana tutaj.
