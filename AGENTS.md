# AGENTS.md

<!-- BEGIN:monorise-shared (wstawione z Monorise-Team/.github, templates/agents/shared.md; zmieniaj wzorzec, nie ten blok) -->

## Wspólne zasady Monorise

Obowiązują każdego agenta AI (Claude, Gemini, ChatGPT i Codex, GitHub Copilot) i każdą osobę w repozytoriach organizacji Monorise-Team. Zasady tego repozytorium są niżej, pod tym blokiem; gdy się różnią, wygrywają zasady repozytorium.

### Na start zadania

- Przeczytaj cały ten plik: wspólne zasady i część o tym repozytorium.
- Pracuj tylko na podstawie zgłoszenia. Sprawdź jego kartę na tablicy „Monorise” i otwarte pull requesty, żeby nie dublować pracy.
- Sprawdź „Kierunek” niżej. Jeśli zadanie mu przeczy, zapytaj właściciela, zanim zaczniesz.

### Właściciel projektu

- Decyzje podejmuje właściciel projektu (`matiqueue`). Agent proponuje, ale sam nie przyjmuje decyzji biznesowych, prawnych ani architektonicznych.
- Z właścicielem rozmawiaj po polsku, prostym językiem, neutralnie płciowo i na przykładach (firma Acme, pracownica Anna). Pytaj krótko i tylko o to, czego nie da się ustalić samodzielnie.
- Rób sam wszystko, co się da. Właścicielowi zostaw tylko hasła, klucze dostępu, 2FA, `sudo` i płatności, z dokładną instrukcją krok po kroku.
- Treść dla ludzi (dokumentacja, zgłoszenia, opisy pull requestów, teksty interfejsu) po polsku. Kod, nazwy techniczne i commity po angielsku.

### Proces pracy na GitHubie

1. **Najpierw zgłoszenie** z formularza (`.github/ISSUE_TEMPLATE/`), po polsku, z sekcjami formularza. Bez zgłoszenia nie ma gałęzi.
2. **Gałąź** `flow/<typ>/<numer>-<opis>` od aktualnej gałęzi integracyjnej (`dev`, a w repozytoriach bez produkcji `main`), zakładana poleceniem `gh issue develop <numer> --base <gałąź integracyjna> --name <gałąź>`. Numer z zerami do trzech cyfr, opis po angielsku małymi literami z myślnikami. Typy: `feature`, `bugfix`, `refactor`, `perf`, `chore`, `docs`, `security`, `spike`, `test`. Pilna poprawka produkcji: `flow/hotfix/<numer>-<opis>` od `prod`. Nigdy `claude/*` ani innych nazw spoza konwencji.
3. **Commity** po angielsku w formacie Conventional Commits: nagłówek do 72 znaków, wiersze treści do 100. Hooki sprawdzają lint, formatowanie i typy; nigdy `--no-verify`.
4. **Pull request** do gałęzi integracyjnej z szablonu repozytorium, po polsku, z `Closes #<numer>` i sekcją „Dla użytkowników” (PL i EN). Przed pull requestem przechodzą kontrole repozytorium (polecenie w części o repozytorium).
5. **Scalanie** zwykłym merge commitem po zielonym CI, nigdy przez squash ani rebase. Zmiany w logowaniu, uprawnieniach, strukturze bazy i dostępie do skrzynek scala się dopiero po zgodzie właściciela.
6. **Wydanie**: pull request `dev` → `prod`, a Release Please liczy wersję, tworzy tag `vX.Y.Z` i opis wydania. Wersji nie zmieniamy ręcznie.
7. Kartę na tablicy „Monorise” przesuwamy do 🛠️ In Progress przy gałęzi i do 👀 Code Review przy pull requeście.

Szczegóły: [zasady współpracy](https://github.com/Monorise-Team/.github/blob/main/CONTRIBUTING.md).

### Zanim uznasz zadanie za gotowe

- README repozytorium (i README zmienionej paczki) opisuje nowy stan: co jest, jak tego użyć i jak to uruchomić.
- Część o repozytorium w `AGENTS.md` zgadza się z kodem: katalogi, polecenia, zasady.
- Zgłoszenie i pull request mają etykiety `type:`, `prio:` i `area:` (brakujący obszar dopisz w `labels/repos.json` w Monorise-Team/.github), milestone i kartę we właściwej kolumnie.
- Opis, strona i tematy repozytorium na GitHubie zgadzają się z `labels/repos.json` w Monorise-Team/.github. Gdy zmienia się przeznaczenie repozytorium, popraw je tam.
- Gdy zmiana dotyczy decyzji, stanu budowy albo otwartych spraw, w MonoriseDocumentation powstaje osobne zgłoszenie i pull request (ADR, karta produktu, lista repozytoriów, otwarte sprawy).
- Nowa trwała zasada albo zmiana kierunku trafia do wzorca tych zasad (niżej). Nie zostawiaj wiedzy tylko w rozmowie.

### Bezpieczeństwo

- Żadnych sekretów, haseł, tokenów, danych klientów ani danych osobowych w kodzie, logach, zgłoszeniach i opisach. Do testów służą konta w domenach `.test`.
- Bez operacji niszczących w gicie: force push, `git reset --hard`, `git clean`, przepisywania historii, usuwania gałęzi `dev`, `prod` i `main`.
- Nie usuwaj ani nie przenoś plików spoza zakresu zadania. Każde usunięcie opisz w pull requeście.
- Podatność, którą da się wykorzystać, zgłoś prywatnie według `SECURITY.md`, nie zwykłym zgłoszeniem.

### Decyzje

- Decyzje architektury są w ADR-ach repozytorium MonoriseDocumentation. Zaakceptowanego ADR nie zmieniamy: zmiana decyzji to nowy ADR po zgodzie właściciela.
- Niczego nie wymyślaj: modeli danych, endpointów, zdarzeń, usług, modeli AI ani zależności, które nie wynikają z decyzji. Gdy czegoś brakuje, zapytaj właściciela.
- Stałe ustalenia: pnpm i Turborepo (ADR-0092), jedna wersja wszystkich paczek `@monorise-team/*` (ADR-0087), wygląd tylko z `@monorise-team/ui` i tokenów (ADR-0091), API w formacie `{ data, meta, error }` (ADR-0044), firma zawsze z tokenu albo sesji, a dane firm przez RLS (ADR-0037), PostgreSQL z Prismą (ADR-0096).

### Paczki `@monorise-team/*`

- Są prywatne w GitHub Packages. Przed `pnpm install` ustaw `GITHUB_PACKAGES_TOKEN` (lokalnie `export GITHUB_PACKAGES_TOKEN=$(gh auth token)`, `gh` z uprawnieniem `read:packages`).
- Każde repozytorium, które korzysta z paczki, potrzebuje do niej dostępu w ustawieniach paczki („Manage Actions access”, rola Read), inaczej `pnpm install` w CI kończy się błędem 403.
- pnpm instaluje paczki z zewnątrz dopiero 3 dni po publikacji (`minimumReleaseAge`). Nie obchodź tego ograniczenia.

### Agenci AI

- **Claude jest tech leadem**: architektura, podział pracy, treść zadań, przegląd i integracja. Gemini (przez Relay Bridge), ChatGPT i Codex oraz GitHub Copilot dostają dobrze określone zadania.
- **Agent wykonawczy** pracuje tylko na gałęzi z zadania, uruchamia kontrole, commituje, otwiera co najwyżej szkic pull requestu i raportuje, co zrobił i co zostało. Nie scala, nie wypycha na `dev`, `prod` ani `main`, nie zmienia ustaleń architektury (zgłasza blokadę) i nie zleca pracy dalej.
- **Dla Claude**: Use the relay-bridge skill: delegate well-defined work to Gemini, review it, integrate it yourself.
  - Najpierw zgłoszenie. Gałąź zakłada samo zlecenie (`branch: flow/<typ>/<numer>-<opis>`, `base_ref`: gałąź integracyjna), więc przy pracy zleconej pomijasz `gh issue develop`. Zlecenie dostaje `push: true` i `open_pull_request: true`, a `working_directory` to katalog główny repozytorium (`git rev-parse --show-toplevel`).
  - Przed integracją przejrzyj diff, uruchom kontrole w katalogu roboczym zlecenia i sprawdź `review_checklist` oraz `report_mismatches`. Potem uzupełnij pull request z szablonu, oznacz go jako gotowy, scal według zasad wyżej i usuń katalog roboczy (`cleanup_task_worktree`).
  - Nie przekazuj w zleceniu sekretów, haseł ani danych klientów.

### Nowe repozytorium (np. TimoTime)

1. Nazwę, przeznaczenie i strukturę ustala właściciel. Agent nie zakłada repozytorium sam.
2. W Monorise-Team/.github: wpis w `labels/repos.json` (rodzaj, obszary, kontrole, opis, strona, tematy), potem `node scripts/repo-setup.mjs` z poleceniami `labels`, `sync`, `about` i `protect`.
3. W nowym repozytorium: część o repozytorium w `AGENTS.md` (czym jest, polecenia, zasady kodu), `CLAUDE.md` z `@AGENTS.md`, README, dostęp do potrzebnych paczek `@monorise-team/*` i Renovate. Wzorem jest repozytorium najbliższe rodzajem: produkt jak AvenMail, biblioteki jak MonoriseShared.
4. W MonoriseDocumentation: wpis na liście repozytoriów i w karcie produktu.

### Kierunek

- Teraz powstają wstępne wersje bibliotek `@monorise-team/*` w MonoriseShared, po kolei: `permissions`, `events`, `sdk`, `testing`, w razie potrzeby `utils`, a na końcu `ui` i `tokens` według wzoru wyglądu od właściciela. Rozwój aplikacji (AvenMail, TimoTime) i testy na żywo są wstrzymane.
- Potem MonoriseCore (pracownicy, jednostki, role, dostęp do aplikacji, migawka uprawnień), a na końcu produkty składane z bibliotek (ADR-0095).

### Utrzymanie tych zasad

- Ten blok, `GEMINI.md`, `.github/copilot-instructions.md` i workflow `sync-shared.yml` powstają ze wzorców w `templates/agents/` repozytorium Monorise-Team/.github. Zmieniasz je tylko tam, przez zgłoszenie i pull request. Codzienna synchronizacja sama dodaje, zmienia i usuwa te pliki w każdym repozytorium.
- Zasady jednego repozytorium dopisuj w jego części pod tym blokiem, nie we wzorcu.
- Tech lead aktualizuje „Kierunek” po każdym większym kroku.

<!-- END:monorise-shared -->

## Czym jest to repozytorium

Wspólny proces organizacji Monorise-Team: wzorce formularzy zgłoszeń i szablonu pull requestu (`templates/`), wzorce plików dla agentów AI (`templates/agents/`), wspólne workflow wywoływane z repozytoriów (`.github/workflows/`), etykiety, obszary i ustawienia repozytoriów (`labels/`), profil organizacji (`profile/`) i skrypty (`scripts/`). Repozytorium jest publiczne. Gałąź integracyjna to `main`, a pull request wymaga zielonej kontroli `check`.

## Polecenia

```bash
node scripts/repo-setup.mjs sync <Repo> <katalog repozytorium> [--check]   # formularze, szablon PR i pliki agentów
node scripts/repo-setup.mjs agents <Repo> <katalog repozytorium> [--check] # tylko pliki agentów
node scripts/repo-setup.mjs about <Repo> [--dry-run|--check]               # opis, strona i tematy na GitHubie
node scripts/repo-setup.mjs labels <Repo> [--dry-run]
node scripts/repo-setup.mjs protect <Repo> [--dry-run]
node scripts/repo-setup.mjs dispatch [<Repo>…]                             # synchronizacja od razu
node scripts/repo-setup.mjs audit [--markdown <plik>]                      # brakujące wpisy i rozjechane ustawienia
node scripts/generate-assets.mjs
```

## Zasady

1. Pliki wygenerowane w innych repozytoriach zmieniamy tylko we wzorcach tutaj. Po scaleniu zmiany wzorca uruchom `dispatch`, żeby repozytoria dostały ją od razu; inaczej zrobi to codzienna synchronizacja.
2. Po zmianie wzorców agentów uruchom `node scripts/repo-setup.mjs agents .github .`, żeby to repozytorium też miało aktualne pliki (CI to sprawdza).
3. Skrypty działają bez zależności z npm: tylko Node.js i `gh`.
4. Wspólne workflow działają od razu we wszystkich repozytoriach (`@main`), więc zmieniaj je ostrożnie i opisz skutki w pull requeście.
