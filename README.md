# ⚔ Arena Polanów — ALFA 0.3.0 (przygotowanie do hostingu)

Przeglądarkowe RPG z animowaną walką PvE/PvP, kontami, ekwipunkiem, sklepem, wyprawami, łupami i rankingiem. Wersja 0.3 dodaje zabezpieczenia serwera, przepisy na wdrożenie oraz kopie zapasowe SQLite. Jest to **wersja testowa**, nie przeprowadzono jeszcze pełnego audytu bezpieczeństwa.

## Gra lokalna

Wymagane Node.js 22.13+ (zalecana wersja 24), npm:

```bash
npm install
npm start
```

Otwórz http://localhost:3000. Testy logiki: `npm test`.

## Publiczny hosting — Render z trwałym dyskiem

**Uwaga na opłaty:** ten wariant wykorzystuje **płatny** plan Render z trwałym dyskiem. Nie uruchamiaj płatnych zasobów, zanim zaakceptujesz ceny pokazane przez dostawcę.

1. Utwórz prywatne repozytorium GitHub i prześlij zawartość folderu projektu. Pliki `data/`, `backups/` i `.env` są ignorowane przez Git.
2. W panelu Render wybierz **New → Blueprint**, połącz repozytorium i wskaż `render.yaml`.
3. Sprawdź aktualną wycenę usługi i dysku. Potwierdź wdrożenie dopiero po akceptacji kosztu.
4. Render zbuduje Dockerfile i wystawi adres HTTPS, np. domenę nadaną przez usługę. **Nie ma go jeszcze, dopóki nie wdrożysz projektu.**
5. W ustawieniach projektu zapewnij **jedną instancję** aplikacji. SQLite i pamięć pokojów Socket.IO są współdzielone tylko w obrębie pojedynczej instancji. Nie włączaj skalowania horyzontalnego.
6. Ustaw `DB_PATH=/var/data/arena.sqlite`, `BACKUP_DIR=/var/data/backups`, `TRUST_PROXY=1`. W pliku `render.yaml` są one już określone.
7. Sprawdź `GET /health`, załóż dwa testowe konta i zagraj w dwóch osobnych sesjach przeglądarki.
8. Dodaj **zewnętrzne kopie bazy** (np. bezpieczny storage poza serwerem) i przećwicz odtwarzanie przed otwarciem gry dla szerokiej publiczności.

**Nie wdrażaj tego projektu jako zwykłej funkcji serverless na Vercel.** Wymaga stałego serwera WebSocket i trwałego pliku SQLite. Alternatywnie: VPS z Dockerem i wolumenem na dane.

## Docker na VPS

```bash
docker build -t arena-polanow .
docker volume create arena_polanow_data
docker run -d --name arena-polanow --restart unless-stopped \
  -p 127.0.0.1:3000:3000 -v arena_polanow_data:/var/data \
  -e DB_PATH=/var/data/arena.sqlite \
  -e BACKUP_DIR=/var/data/backups -e NODE_ENV=production \
  arena-polanow
```

Użyj zewnętrznego reverse proxy z HTTPS (np. Caddy) dla domeny. Nie wystawiaj portu 3000 bezpośrednio w internecie. Dla HTTPS ustaw `TRUST_PROXY=1` wyłącznie za zaufanym proxy.

## Dane graczy i kopie

Wszystkie konta, postacie, sklep, łupy i rankingi zapisują się w `DB_PATH`. Domyślnie jest to `./data/arena.sqlite`. **Nie kasuj ani nie nadpisuj tej bazy podczas aktualizacji.**

Spójna kopia (SQLite `VACUUM INTO`) i kontrola integralności:

```bash
npm run backup
npm run backup:verify -- /sciezka/do/kopii.sqlite
```

`BACKUP_DIR` wybiera katalog kopii, `BACKUP_KEEP=14` ustala ich liczbę. Zaplanuj cykliczne uruchamianie komendy `npm run backup` (cron/scheduler hostingu) i przechowuj zaszyfrowane kopie poza serwerem. **Kopie w katalogu na tym samym dysku nie chronią przed utratą samego dysku.** Test przywrócenia: wyłącz serwer, odłóż stary plik bazy w bezpieczne miejsce, skopiuj zweryfikowaną kopię pod `DB_PATH`, uruchom serwer i sprawdź konto testowe.

## Zabezpieczenia dodane w 0.3

- Limity prób rejestracji (5/15 min na IP) i logowania (10/15 min na IP), osobne ograniczenia zakupów i wypraw.
- Nagłówki CSP, anti-framing, `nosniff`, no-referrer; HSTS tylko przy HTTPS w środowisku produkcyjnym.
- Każda akcja Socket.IO weryfikuje, czy token sesji nadal istnieje w bazie. Wylogowanie kończy także aktywne połączenia konta z tą sesją.
- Blokada udziału tego samego konta w dwóch pokojach walk jednocześnie, także przy kilku kartach przeglądarki.
- Kody pokojów losowane kryptograficznie.
- Transakcje SQLite dla złota i łupów, sól+scrypt dla haseł; baza na trwałym dysku.

## Ograniczenia i kolejne kroki

- To nadal **pojedynczy serwer**, SQLite i pokoje PvP w RAM; restart kończy bieżące walki. Nie ma odzyskiwania hasła, weryfikacji email, moderacji, ochrony przed botami, antycheatu na poziomie ekonomii czy monitoringu.
- Sesje klient przechowuje w `localStorage`; przed docelową produkcją rekomendowane jest przejście na bezpieczne ciasteczka HttpOnly, rotację sesji i dodatkowe testy bezpieczeństwa.
- Limity API działają w RAM; przy wielu instancjach wymagają zewnętrznego magazynu (Redis). Prywatne pokoje i matchmaking również wymagają adaptera współdzielącego stan.
- Konieczne są zewnętrzne kopie danych, regularne aktualizacje zależności i testy całego UI w przeglądarce.

## API

`POST /api/signup`, `POST /api/login`, `GET /api/me`, `POST /api/logout`, `GET /api/shop`, `POST /api/shop/buy`, `POST /api/equip`, `GET /api/expeditions`, `POST /api/expeditions/start`, `GET /api/ranking`, `GET /health`.

API gry wymaga `Authorization: Bearer <token>`. Socket.IO weryfikuje token przy próbie wykonania akcji.
