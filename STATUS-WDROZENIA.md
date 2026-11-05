# Arena Polanów 0.4 — faktyczny stan migracji (2026-11-05)

- Nowy projekt Supabase: `arena-polanow` (region eu-central-1; plan Free, wycena 0 USD/mies.).
- Schemat `arena` i pięć tabel: `users`, `heroes`, `inventory`, `sessions`, `activity` zostały utworzone i zweryfikowane.
- Uprawnienia `anon` i `authenticated` do tych tabel są odebrane. Schemat nie jest udostępniany klientowi przeglądarkowemu.
- Test SQL na żywo: dodanie użytkownika, bohatera, przedmiotu i odjęcie złota, następnie rollback. Wszystkie tabele pozostały puste.
- Testy lokalne: sześć testów mechaniki walki zaliczonych, składnia `database-pg.js` i `server.js` sprawdzona.
- Publiczna gra na Render **nadal działa na SQLite**. Nie ustawiono `DATABASE_URL`, nie wdrożono kodu 0.4, nie importowano istniejących kont.
- Do końca wdrożenia: zachować/wyeksportować aktualną bazę SQLite, przesłać kod 0.4 do GitHub, ustawić prywatną zmienną `DATABASE_URL` w Render, wykonać testy integracyjne i przełączyć dopiero po potwierdzeniu.
- Supabase: nie umieszczaj poświadczeń w repozytorium; użyj trybu Session Pooler i TLS. Projekt `Nasz Dom` nie został zmieniony.

**Ważne:** Darmowy Render nie oferuje trwałego dysku dla tej aplikacji. Kolejny deploy może usunąć dotychczasowy plik SQLite. Nie wykonuj redeployu przed uzyskaniem kopii bazy, jeśli są już konta graczy.
