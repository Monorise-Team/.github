# Monorise-Team/.github

Wspólne pliki organizacji Monorise:

| Gdzie | Co |
| --- | --- |
| `profile/` | profil organizacji na GitHubie (`profile/README.md`, grafiki, statystyki) |
| `CONTRIBUTING.md`, `SECURITY.md` | zasady pracy i zgłaszania podatności dla wszystkich repozytoriów |
| `templates/` | wzorce formularzy zgłoszeń i szablonu pull requestu |
| `labels/` | etykiety wspólne (`common.json`) oraz obszary i ustawienia każdego repozytorium (`repos.json`) |
| `.github/workflows/` | automaty zgłoszeń i pull requestów, powrót `prod` do `dev`, wywoływane z repozytoriów jedną linijką |
| `scripts/repo-setup.mjs` | rozsyła formularze, etykiety i reguły ochrony gałęzi do repozytorium |

```bash
node scripts/repo-setup.mjs forms AvenMail ../AvenMail/.github   # formularze i szablon PR
node scripts/repo-setup.mjs labels AvenMail                      # etykiety
node scripts/repo-setup.mjs protect AvenMail                     # ustawienia i reguły ochrony gałęzi
```

Zasady opisuje [CONTRIBUTING.md](CONTRIBUTING.md).
