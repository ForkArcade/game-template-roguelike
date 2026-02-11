Ten projekt to gra typu Roguelike na platformę ForkArcade.

## SDK
SDK jest podpięty w index.html. Używaj:
- `ForkArcade.onReady(cb)` — start gry po połączeniu z platformą
- `ForkArcade.submitScore(score)` — wyślij wynik po śmierci gracza
- `ForkArcade.getPlayer()` — info o zalogowanym graczu

## Typ gry
Proceduralne dungeony, permadeath, tile-based movement, turowy combat.
Gracz eksploruje, walczy bump-to-attack, zbiera loot, schodzi głębiej.

## Scoring
Score = (dungeon_depth * 100) + (enemies_killed * 10) + (gold_collected) + (items_found * 25)

## Plik wejściowy
Cała logika gry w `game.js`. Renderowanie na `<canvas id="game">`.
