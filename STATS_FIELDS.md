# DELVE: Отслеживаемые параметры игрока

Все показатели хранятся в `localStorage` по ключу `delve_stats_v1`.
Основной код статистики: `src/stats.js`.

## meta
- `version`: версия данных/сборки.
- `firstLaunchAt`: дата первого запуска.
- `lastLaunchAt`: дата последнего запуска.
- `launches`: сколько раз запускалась игра.
- `resets`: сколько раз делали сброс прогресса.
- `savesLoaded`: сколько раз загружался блок статистики.
- `savesSaved`: сколько раз статистика сохранялась.
- `errorsCount`: счетчик ошибок статистики.
- `totalPlaySeconds`: общее время в игре.

## resources
- `totalOreMined`: всего добыто руды.
- `totalOreSold`: всего продано руды.
- `totalGoldEarned`: всего заработано золота.
- `goldSpent`: всего потрачено золота.
- `oreSpentOnUpgrades`: руды потрачено на апгрейды.

## runs
- `total`: всего вылазок.
- `clear`: успешных вылазок.
- `death`: смертей.
- `escape`: досрочных выходов.
- `longestSeconds`: самая длинная вылазка.
- `shortestSeconds`: самая короткая вылазка.
- `currentCollapseStreak`: служебный счетчик серии обвалов.
- `currentEmptyStreak`: текущая серия действий без руды.
- `maxEmptyStreak`: максимум серии без руды.
- `currentRunCollapses`: обвалов в текущей вылазке.
- `speedWindow`: окно таймстампов для ачивки скорости.

## cells
- `openedTotal`: всего открыто клеток.
- `emptyFound`: найдено пустых клеток.
- `oreFoundCells`: найдено/собрано рудных клеток.
- `unstableActivated`: активировано нестабильных клеток.
- `flagsPlaced`: поставлено флагов.
- `flagsRemoved`: снято флагов.

## difficulty
Для `easy`, `normal`, `hard`:
- `total`: вылазок.
- `clear`: успешных.
- `death`: смертей.
- `escape`: побегов.
- `bestOre`: лучший результат по руде за вылазку.
- `minClearSeconds`: лучший спидран зачистки.

## shop
- `visitorsTotal`: всего посетителей.
- `purchasesTotal`: всего покупок.
- `avgCheckGold`: средний чек в золоте.
- `maxPurchaseGold`: самая крупная покупка.
- `visitorsPeakPerMinute`: пик посетителей в минуту.
- `visitorsPeakPerHour`: пик посетителей в час.
- `visitorsByMinute`: служебная карта статистики по минутам.
- `visitorsByHour`: служебная карта статистики по часам.
- `lastPurchaseAt`: время последней покупки.
- `incomeTotal`: суммарный доход магазина.
- `emptySinceSeconds`: сколько секунд без покупок.

## collapses
- `total`: всего обвалов.
- `byHit`: обвалы от удара по нестабильной клетке.
- `byIdle`: обвалы от бездействия.
- `cellsDestroyed`: клеток уничтожено обвалами.
- `oreLost`: руды потеряно в обвалах.
- `maxSingle`: самый большой обвал (клеток за раз).
- `lastAt`: время последнего обвала.

## character
- `level`: текущий уровень шахтёра (1..60).
- `xp`: общий накопленный опыт.
- `title`: текущий титул уровня (из списка 60 титулов).
- `xpIntoLevel`: опыт, набранный внутри текущего уровня.
- `xpForNextLevel`: сколько опыта нужно на следующий уровень.
- `xpToNextLevel`: сколько осталось до следующего уровня.
- `rewardsUnlocked.level10Helmet`: открыта награда за 10 уровень.
- `rewardsUnlocked.level20Palette`: открыта награда за 20 уровень.
- `rewardsUnlocked.level30TickerTag`: открыта награда за 30 уровень.
- `rewardsUnlocked.level40OreSpark`: открыта награда за 40 уровень.
- `rewardsUnlocked.level50MenuBg`: открыта награда за 50 уровень.
- `rewardsUnlocked.level60ImmortalShovel`: открыта награда за 60 уровень.
- `nameChanges`: сколько раз меняли имя.
- `genderChanges`: сколько раз меняли пол.

### Формула уровней и XP
- Уровни: 60.
- Базовая цена первого уровня: `100 XP`.
- Рост: `~8%` на уровень (`100 * 1.08^(N-1)` с округлением).
- Множители сложности для XP в вылазке:
  - `easy`: `x0.8`
  - `normal`: `x1.0`
  - `hard`: `x1.5`

## economics
- `baseOrePrice`: базовая цена руды.
- `currentOrePrice`: текущая цена руды.
- `inflationPct`: индекс инфляции цены.
- `orePerGold`: сколько руды на 1 золото.
- `productivityOrePerMin`: производительность (руда/мин).
- `deathsPer1000Cells`: травматизм на 1000 клеток.
- `deathCostPerOre`: смертей на 1 руду.

## atmosphere
- `daysWithoutIncidents`: дней без обвалов.
- `deathStreak`: текущая серия смертей.
- `successStreak`: текущая серия успешных вылазок.
- `lastDeathAt`: время последней смерти.
- `lastRunAt`: время последней вылазки.
- `cursesCount`: счетчик “проклятий мира” (растет при обвалах).

## peaks
- `maxBankOre`: пик руды в банке.
- `maxGold`: пик золота.
- `maxHpInRun`: максимальный HP в вылазке.

## achievements
- `gravedigger100Deaths`: 100 смертей.
- `digger1000Cells`: 1000 открытых клеток.
- `oligarch10000Ore`: 10000 руды в банке.
- `trader1000Gold`: 1000 золота заработано.
- `sapper100Unstable`: 100 нестабильных клеток.
- `coward50Escapes`: 50 досрочных выходов.
- `lucky1HpSurvivor`: выжить с 1 HP.
- `problems5CollapsesRun`: 5 обвалов за одну вылазку.
- `speed50cells10s`: 50 открытых клеток за 10 секунд.
