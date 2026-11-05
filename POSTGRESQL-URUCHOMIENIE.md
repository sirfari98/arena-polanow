# Arena Polanów — PostgreSQL (przygotowany wariant ALFA 0.4)

**Nie wdrażać na żywo bez testów integracyjnych** — testy składni i testy mechaniki walki przeszły pomyślnie, ale nie wykonano jeszcze testu na rzeczywistym PostgreSQL ani migracji użytkowników.

## Wybór trybu

- Bez `DATABASE_URL` gra zachowuje dotychczasowe działanie na SQLite (tryb awaryjny/testowy).
- Z ustawionym `DATABASE_URL` serwer przechodzi na PostgreSQL. Dane SQLite NIE są przenoszone automatycznie.
- Nie udostępniaj `DATABASE_URL` w repozytorium. Ustaw wyłącznie w Render → Environment. Używaj połączenia Supabase Pooler (Session mode), szyfrowanego SSL.

## Etapy wdrożenia

1. Utwórz osobny darmowy projekt Supabase `arena-polanow` w **wybranej przez właściciela organizacji**, nie używaj bazy innego projektu.
2. Sprawdź limity Free i możliwość usypiania projektu przy braku aktywności. Free nie daje gwarancji działania 24/7.
3. Wyślij pliki do GitHub na osobną gałąź testową, wykonaj `npm install`, `npm test`, uruchom bazę testową i testy logowania, zakupów, ekspedycji, rankingu oraz PvP.
4. Jeśli istnieją gracze w SQLite, uzyskaj kopię SQLite PRZED redeployem; uruchom `node scripts/migrate-sqlite-to-pg.js` w bezpiecznym środowisku. Nigdy nie kopiuj pliku SQLite ani DATABASE_URL do publicznego repozytorium.
5. Ustaw `DATABASE_URL` tylko w zmiennych serwera na Render. Zweryfikuj status `/health`, ekran główny, logowanie, zakup, wyprawy, dwa niezależne konta w PvP. Dopiero potem przełącz produkcję.
6. Na darmowym Render aplikacja może spać. Dla stabilnej produkcji planuj płatny hosting i niezależne kopie zapasowe PostgreSQL.

## Uwaga o uprawnieniach

Nowe tabele tworzone są w osobnym schemacie `arena`, nie w `public`. Poświadczenia bazy służą WYŁĄCZNIE serwerowi Node. W tym wariancie brak dostępu bezpośredniego dla klienta przeglądarkowego przez API Supabase.
