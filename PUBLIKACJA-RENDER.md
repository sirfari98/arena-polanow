# Publikacja Arena Polanów 0.4 (Render Free + Supabase Free)

Stan: schemat `arena` na Supabase utworzony; stare konta SQLite nie są przenoszone na wyraźne życzenie właściciela. **Nie publikuj tajnych danych w GitHub.**

## 1. GitHub
Zaktualizuj repozytorium `sirfari98/arena-polanow`, kopiując **zawartość folderu `arena-polanow`** z tej paczki (a nie folder nadrzędny). W szczególności wymagane: `database-pg.js`, `server.js`, `package.json`, `public/`, `Dockerfile`. Nie przesyłaj `.env` ani SQLite.

## 2. Supabase
Otwórz https://supabase.com/dashboard/project/mrkelzhpuhsuoqabxcye i wybierz **Connect → Session Pooler** (port 5432). Użyj hosta wskazanego przez panel. Dla Render utwórz osobną rolę logowania z dostępem do schematu `arena`, operacji na jego tabelach i użycia jego sekwencji. Nazwa użytkownika w Session Pooler ma postać `nazwa_roli.identyfikator_projektu`. Nie przesyłaj URI do czatu. Aplikacja wymusza TLS z weryfikacją certyfikatu na Render, dlatego URI nie powinien zawierać parametrów TLS.

## 3. Render
Otwórz https://dashboard.render.com/web/srv-dbm7tf08v5cc73drb2hg → Environment. Utwórz `DATABASE_URL` (tajna wartość URI połączenia). Pozostaw `NODE_ENV=production`, `TRUST_PROXY=1`; nie usuwaj pozostałych zmiennych bez potrzeby. Następnie uruchom manual deploy po aktualizacji repozytorium, ponieważ `autoDeploy` jest wyłączone.

## 4. Testy
- https://arena-polanow.onrender.com/health musi zwracać `status: ok` i `database: postgresql`.
- Zarejestruj konto, utwórz postać, wykonaj wyprawę, kup przedmiot, sprawdź ranking i PvP z drugim kontem.
- Po restarcie usługi sprawdź, czy konta nadal istnieją w PostgreSQL.

## Ryzyko i ograniczenia
Darmowy Render może się usypiać i nie jest gwarancją 24/7; darmowy Supabase także może wstrzymywać nieaktywne projekty. Dbaj o kopie zapasowe danych. Wersja 0.4 nie przenosi dotychczasowych kont SQLite — ich utrata przy redeployu jest zaakceptowanym kompromisem.

Na Render `DATABASE_URL` jest wymagany. Lokalnie aplikacja może działać na SQLite.
