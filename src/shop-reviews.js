const KEY_SHOP_REVIEWS = "delve_shop_reviews_v1";
const MAX_REVIEWS = 36;

function nowIso() {
  return new Date().toISOString();
}

function safeArray(raw) {
  return Array.isArray(raw) ? raw : [];
}

export function getShopReviews() {
  try {
    const raw = localStorage.getItem(KEY_SHOP_REVIEWS);
    if (!raw) return [];
    return safeArray(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function resetShopReviews() {
  localStorage.removeItem(KEY_SHOP_REVIEWS);
}

function saveShopReviews(list) {
  localStorage.setItem(
    KEY_SHOP_REVIEWS,
    JSON.stringify(list.slice(-MAX_REVIEWS)),
  );
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export function buildShopReview(context) {
  const sold = context.totalOreSold ?? 0;
  const silver = context.totalSilverEarned ?? 0;
  const ads = context.adsLevel ?? 0;
  const purchases = context.purchasesTotal ?? 0;
  const lastOre = context.lastSaleOre ?? 0;
  const lastSilver = context.lastSaleSilver ?? 0;

  let mood = 0;
  if (sold > 250) mood += 1;
  if (silver > 900) mood += 1;
  if (ads >= 2) mood += 1;
  if (purchases > 70) mood += 1;
  if (lastOre <= 1) mood -= 1;
  if (ads === 0) mood -= 1;

  const positive = [
    `“Забрал ${lastOre} руды за ${lastSilver} монет. Тут стабильно, вернусь еще.”`,
    "“Лавка бодрая, руда чистая. Цена норм.”",
    "“Сервис быстрый, продавец молчаливый. Идеально.”",
    "“После рекламы сюда реально стало проще попадать. Респект.”",
    `“Продажи растут: уже ${sold} руды через эту лавку. Это уровень.”`,
  ];
  const neutral = [
    "“Руда есть, очередей нет. Ахренеть.”",
    `“Взял немного руды. В кассе у вас уже ${silver} монет — держитесь.”`,
    "“Нормально.”",
    "“Зашел, купил, ушел. Мне подходит.”",
    `“Какой то мужик раздает свитки с рекламной вашего магазина. Ну я и зашел. Вроде здесь неплохо.”`,
  ];
  const negative = [
    "“Ассортимент неплохой, но хотелось бы скидки для постоянников.”",
    "“Проходил тут мимо, выбор сегодня скромный.”",
    "“Руда ок, атмосфера как в шахте после обвала.”",
    "“Сделка прошла, но продавец выглядит уставшим.”",
    "“Покупка есть, но сервису бы чуть больше тепла.”",
  ];

  const text =
    mood >= 2 ? pick(positive) : mood <= -1 ? pick(negative) : pick(neutral);
  const stars = mood >= 2 ? 5 : mood === 1 ? 4 : mood === 0 ? 3 : 2;

  return {
    text,
    stars,
    at: nowIso(),
  };
}

export function addShopReview(review) {
  const list = getShopReviews();
  list.push(review);
  saveShopReviews(list);
  return review;
}
