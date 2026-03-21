# Przygotowanie laptopa na openBIM Hackathon Porto 2026

Ta paczka jest przygotowana pod wydarzenie `openBIM Hackathon 2026` w dniach `22-24 marca 2026` w Porto.
Z oficjalnej strony wynika, ze projekty powinny korzystac z co najmniej jednego z obszarow `IFC`, `IDS`, `BCF`, `bSDD` lub Validation Service, a wyniki pracy powinny trafic do publicznego repozytorium GitHub.

Zrodlo:
- https://www.buildingsmart.org/openbim-hackathon-porto-2026/

## Co juz sprawdzilem na tym laptopie

Obecny stan jest surowy:
- `git` nie jest zainstalowany
- `node` i `npm` nie sa zainstalowane
- `docker` nie jest zainstalowany
- `python` ma tylko pusty alias Windows Store i nie ma realnej instalacji
- `winget.exe` istnieje, ale w tej chwili nie uruchamia sie poprawnie

## Minimalny zestaw przed wyjazdem

Zainstaluj:
- Git
- Visual Studio Code
- Node.js LTS
- Python 3.12
- Docker Desktop
- 7-Zip

Mile widziane:
- Firefox lub Chrome z zalogowanym GitHub
- GitHub Desktop albo skonfigurowany `git` w terminalu
- Slack/Discord/Teams jesli organizatorzy lub zespol beda tego uzywac
- OBS lub Loom tylko jesli chcesz szybko nagrac demo

## Co masz w tym katalogu

- `install-hackathon-base.ps1` - skrypt instalacyjny oparty o `winget`
- `verify-hackathon-base.ps1` - szybka weryfikacja po instalacji

## Szybki plan dzialania

1. Napraw `winget`
2. Uruchom `.\install-hackathon-base.ps1`
3. Zrestartuj komputer
4. Uruchom `.\verify-hackathon-base.ps1`
5. Zaloguj sie do GitHub i Docker Desktop
6. Skonfiguruj klucze albo HTTPS do GitHub
7. Pobierz 1-2 przykladowe modele IFC przed wyjazdem
8. Sprawdz, czy hotspot z telefonu dziala na wszelki wypadek

## Jak naprawic winget

Najbardziej prawdopodobny problem na tym laptopie to uszkodzony alias z `WindowsApps`.

Sprobuj:
1. Otworz `Microsoft Store`
2. Wyszukaj `App Installer`
3. Zaktualizuj lub zainstaluj aplikacje
4. Wyloguj i zaloguj sie ponownie do Windows albo uruchom restart
5. Sprawdz w PowerShell: `winget --version`

Jesli dalej nie dziala:
- uruchom Windows Update
- sprawdz, czy konto ma dostep do Microsoft Store
- rozwaz instalacje narzedzi recznie ze stron producentow

## Konto i bezpieczenstwo na laptopie zony

Poniewaz to nie jest Twoj laptop, zrob minimum porzadku juz teraz:
- utworz osobne konto Windows dla siebie, jesli to mozliwe
- nie zapisuj hasel w cudzej przegladarce bez swiadomosci wlascicielki
- uzyj menedzera hasel albo logowania przez telefon
- po wydarzeniu wyloguj GitHub, Docker, VS Code sync i komunikatory
- jesli sklonujesz prywatne repo, upewnij sie po powrocie, ze dane nie zostaly w profilach przegladarki

## Konfiguracja GitHub

Przed wyjazdem upewnij sie, ze dziala jedno z ponizszych:
- GitHub przez HTTPS i browser login
- GitHub przez SSH

Sprawdz:
- `git config --global user.name`
- `git config --global user.email`

Przykladowo:

```powershell
git config --global user.name "Twoje Imie"
git config --global user.email "twoj@email.pl"
```

## Zalecany styl pracy na hackathonie

Najbezpieczniejszy start:
- frontend lub dashboard w `Node.js`
- skrypty i analiza IFC/IDS w `Python`
- kontenery tylko jesli zespol naprawde ich potrzebuje

To daje elastycznosc:
- szybki prototyp UI
- szybkie skrypty do parsowania, walidacji i transformacji danych
- prosty backend, jesli bedzie potrzebny

## Co pobrac przed wyjazdem

Warto miec offline:
- 1-2 przykladowe pliki IFC
- notatke z pomyslami na 2-3 problemy do rozwiazania
- lokalny folder na screeny i pitch
- publiczne repo GitHub zalozone wczesniej

## Pomysly, pod ktore warto sie przygotowac

Oficjalny opis wydarzenia wskazuje typowe kierunki:
- walidacja danych IFC lub IDS
- viewer lub dashboard dla modeli IFC
- automatyzacja modelowania i ekstrakcji danych
- workflow dla sustainability albo facility management

## Po instalacji

Uruchom i sprawdz:

```powershell
.\verify-hackathon-base.ps1
```

Jesli chcesz, w kolejnym kroku moge Ci jeszcze przygotowac gotowy starter projektu `Node + Python` pod openBIM, zebys mial od razu szkielet repo na start.
