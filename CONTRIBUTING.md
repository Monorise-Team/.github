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

Automat dopisuje do tytułu typ i numer (`🐛 Bugfix: [009] Problem z załącznikami`), nakłada etykiety z formularza, przypisuje autora i milestone najbliższego wydania, a kartę dodaje na tablicę „Monorise”.

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

## Wspólne pliki

To repozytorium (`Monorise-Team/.github`) trzyma wzorce: formularze (`templates/`), etykiety i ustawienia repozytoriów (`labels/`), automaty zgłoszeń i pull requestów (`.github/workflows/`) oraz skrypt `scripts/repo-setup.mjs`, który rozsyła je do repozytoriów. Zmiana procesu to zmiana tutaj.
