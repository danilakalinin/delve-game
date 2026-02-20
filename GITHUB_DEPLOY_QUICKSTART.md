# Быстрая справка: как обновлять игру на GitHub Pages и домене

Этот проект деплоится через GitHub Pages (workflow в `.github/workflows/deploy-pages.yml`).
Оба адреса обновляются из одного источника:

- `https://danilakalinin.github.io/delve-game/`
- `https://delvegame.ru` (и `https://www.delvegame.ru`)

## 1) Обычный цикл после изменений

В корне проекта выполни:

```bash
git status
git add .
git commit -m "Коротко что изменил"
git push origin main
```

После `push` GitHub Actions сам соберет проект и выложит новую версию.

## 2) Проверка, что деплой прошел

1. Открой репозиторий на GitHub.
2. Перейди во вкладку `Actions`.
3. Убедись, что workflow `Deploy to GitHub Pages` завершился со статусом `Success`.

Если статус неуспешный, открой run и посмотри ошибку в шагах `Build` или `Deploy`.

## 3) Где смотреть обновления

Сначала проверь:

- `https://danilakalinin.github.io/delve-game/`

Потом:

- `https://delvegame.ru`

Если браузер показывает старую версию, сделай hard reload:

- macOS: `Cmd + Shift + R`

## 4) Важно для домена

Домен в REG.RU должен быть делегирован и иметь записи:

- `A @ -> 185.199.108.153`
- `A @ -> 185.199.109.153`
- `A @ -> 185.199.110.153`
- `A @ -> 185.199.111.153`
- `CNAME www -> danilakalinin.github.io.`

И в GitHub должно быть задано:

- `Settings -> Pages -> Custom domain: delvegame.ru`

## 5) Быстрая диагностика

Если `github.io` обновился, а домен нет:

- проблема в DNS/делегировании домена (REG.RU), а не в коде.

Если не обновился даже `github.io`:

- смотри `Actions` и логи workflow.
