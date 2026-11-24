# Monorise-Team/.github

Wspólne pliki organizacji Monorise:

| Gdzie | Co |
| --- | --- |
| `profile/` | profil organizacji na GitHubie (`profile/README.md`, grafiki, statystyki) |
| `CONTRIBUTING.md`, `SECURITY.md` | zasady pracy i zgłaszania podatności dla wszystkich repozytoriów |
| `templates/` | wzorce formularzy zgłoszeń i szablonu pull requestu |
| `templates/agents/` | wzorce wspólnych zasad dla agentów AI (`shared.md`, `GEMINI.md`, `copilot-instructions.md`, `sync-shared.yml`) |
| `labels/` | etykiety wspólne (`common.json`) oraz obszary, ustawienia i dane „About” każdego repozytorium (`repos.json`) |
| `.github/workflows/` | automaty zgłoszeń i pull requestów, powrót `prod` do `dev`, synchronizacja wspólnych plików (`sync-shared.yml`) i audyt organizacji |
| `scripts/repo-setup.mjs` | rozsyła formularze, pliki agentów, etykiety, dane „About”, ustawienia (także uprawnienia GitHub Actions) i reguły ochrony gałęzi; uzupełnia metadane zgłoszeń i PR (`meta`), uruchamia synchronizację i audyt |
| `renovate-config.json` | wspólne ustawienia Renovate: `"extends": ["github>Monorise-Team/.github:renovate-config"]` w `renovate.json` repozytorium |

```bash
node scripts/repo-setup.mjs sync AvenMail ../AvenMail              # formularze, szablon PR i pliki agentów
node scripts/repo-setup.mjs agents AvenMail ../AvenMail [--check]  # tylko pliki agentów AI
node scripts/repo-setup.mjs forms AvenMail ../AvenMail/.github     # tylko formularze i szablon PR
node scripts/repo-setup.mjs about AvenMail [--dry-run|--check]     # opis, strona i tematy na GitHubie
node scripts/repo-setup.mjs labels AvenMail [--dry-run]            # etykiety
node scripts/repo-setup.mjs protect AvenMail [--dry-run]           # ustawienia, uprawnienia Actions i reguły gałęzi
node scripts/repo-setup.mjs dispatch [AvenMail …]                  # natychmiastowa synchronizacja w repozytoriach
node scripts/repo-setup.mjs audit [--markdown raport.md]           # audyt repozytoriów organizacji
node scripts/repo-setup.mjs meta AvenMail [--issue 12] [--dry-run] # uzupełnienie metadanych zgłoszeń i PR
```

Zasady opisuje [CONTRIBUTING.md](CONTRIBUTING.md).
