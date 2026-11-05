# Arena Polanów — bezpieczna migracja kont do Supabase

## Aktualny stan

- Supabase `arena-polanow`: projekt `mrkelzhpuhsuoqabxcye`, schemat `arena`, pięć tabel, brak rekordów.
- Render: `srv-dbm7tf08v5cc73drb2hg` nadal używa lokalnego SQLite. **NIE wdrażaj nowego kontenera ani nie dodawaj DATABASE_URL bez eksportu danych.**
- Lokalnie wykonane 10 testów wersji 0.4: pozytywne. Nie są to testy integracyjne PostgreSQL.

## 1. Zabezpiecz bazę ze starego serwera

Baza obecnie znajduje się pod `/app/data/arena.sqlite` (Render DB_PATH). Na bezpłatnym Render plik jest nietrwały. Bez dostępu do pliku nie da się przenieść utworzonych tam kont.

Jeśli Render udostępnia powłokę w danym planie, wykorzystaj ją do wykonania kopii SQLite funkcją backup (nie zwykłym `cp` przy aktywnym WAL), a następnie bezpiecznie pobierz kopię poza Render. Nie zapisuj kopii w publicznym GitHubie.

**Brak dostępu do pliku?** Wstrzymaj deploy. Zgłoszenie „mogę założyć konta od nowa” to odrębna decyzja, nie automatyczna migracja.

## 2. Przygotuj repozytorium

Wgraj kod 0.4 na osobną gałąź GitHub, nie zastępuj na razie działającej `main`. Sprawdź różnice i uruchom testy.

## 3. Wykonaj import z zabezpieczonej kopii

Na zaufanym komputerze z Node.js 22.13+:

```
npm install
npm test
DB_PATH=/path/to/arena.sqlite DATABASE_URL='(...)' node scripts/migrate-sqlite-to-pg.js
```

Powyższe polecenie domyślnie **nic nie zapisuje**. Aby przenieść dane po przeglądzie liczby rekordów, ustaw `MIGRATE_CONFIRM=YES`. Skrypt wymaga, aby wszystkie docelowe tabele były puste, korzysta z transakcji i porównuje liczby rekordów.

Sekret `DATABASE_URL` pobierz w Supabase → Connect → Session pooler i ustaw lokalnie / w Render → Environment. Nigdy nie przesyłaj go w czacie ani do publicznego repozytorium. Użyj TLS.

## 4. Wdrożenie bez utraty danych

Dopiero gdy import będzie potwierdzony, wgraj 0.4 na `main`, ustaw `DATABASE_URL` w Render, uruchom deploy i sprawdź `/health`, logowanie historycznym kontem, plecak, sklep, wyprawy, ranking i PvP na dwóch kontach. Na darmowym Render serwer może zasypiać.

## 5. Uwagi

Migracja nie oznacza zapewnienia dostępności 24/7. Supabase Free może wstrzymać projekt po bezczynności. Zadbaj o kopie zapasowe poza usługą.
