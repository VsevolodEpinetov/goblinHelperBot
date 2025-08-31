exports.seed = function(knex) {
  // Deletes existing entries
  return knex('lot_tag_assignments').del()
    .then(() => knex('lot_tags').del())
    .then(() => knex('lot_categories').del())
    .then(() => {
      // Inserts seed entries for categories
      return knex('lot_categories').insert([
        {
          id: 1,
          name: 'Миниатюры',
          description: 'Фигурки и миниатюры для настольных игр',
          icon: '🎲',
          is_active: true
        },
        {
          id: 2,
          name: 'Террейн',
          description: 'Ландшафт и окружение для игр',
          icon: '🏔️',
          is_active: true
        },
        {
          id: 3,
          name: 'Краски и материалы',
          description: 'Материалы для покраски и сборки',
          icon: '🎨',
          is_active: true
        },
        {
          id: 4,
          name: 'Книги и правила',
          description: 'Игровые книги, правила и литература',
          icon: '📚',
          is_active: true
        },
        {
          id: 5,
          name: 'Аксессуары',
          description: 'Дополнительные игровые аксессуары',
          icon: '🎯',
          is_active: true
        },
        {
          id: 6,
          name: 'Электроника',
          description: 'Электронные компоненты и устройства',
          icon: '⚡',
          is_active: true
        },
        {
          id: 7,
          name: 'Другое',
          description: 'Прочие категории',
          icon: '📦',
          is_active: true
        }
      ]);
    })
    .then(() => {
      // Inserts seed entries for hashtag-style tags
      return knex('lot_tags').insert([
        // Миниатюры - Game Systems
        { id: 1, name: '#warhammer40k', category_id: 1, description: 'Warhammer 40,000 миниатюры' },
        { id: 2, name: '#ageofsigmar', category_id: 1, description: 'Age of Sigmar миниатюры' },
        { id: 3, name: '#dnd', category_id: 1, description: 'Dungeons & Dragons миниатюры' },
        { id: 4, name: '#starwars', category_id: 1, description: 'Star Wars миниатюры' },
        { id: 5, name: '#marvel', category_id: 1, description: 'Marvel миниатюры' },
        { id: 6, name: '#dccomics', category_id: 1, description: 'DC Comics миниатюры' },
        { id: 7, name: '#anime', category_id: 1, description: 'Аниме стиль миниатюры' },
        { id: 8, name: '#fantasy', category_id: 1, description: 'Фэнтезийные миниатюры' },
        { id: 9, name: '#scifi', category_id: 1, description: 'Научно-фантастические миниатюры' },
        { id: 10, name: '#historical', category_id: 1, description: 'Исторические миниатюры' },
        { id: 11, name: '#zombicide', category_id: 1, description: 'Zombicide миниатюры' },
        { id: 12, name: '#malifaux', category_id: 1, description: 'Malifaux миниатюры' },
        { id: 13, name: '#infinity', category_id: 1, description: 'Infinity миниатюры' },
        { id: 14, name: '#warmachine', category_id: 1, description: 'Warmachine/Hordes миниатюры' },
        { id: 15, name: '#bloodbowl', category_id: 1, description: 'Blood Bowl миниатюры' },
        
        // Террейн - Environment Types
        { id: 16, name: '#mountains', category_id: 2, description: 'Горный ландшафт' },
        { id: 17, name: '#forest', category_id: 2, description: 'Лесной ландшафт' },
        { id: 18, name: '#city', category_id: 2, description: 'Городская среда' },
        { id: 19, name: '#space', category_id: 2, description: 'Космические локации' },
        { id: 20, name: '#dungeon', category_id: 2, description: 'Подземные локации' },
        { id: 21, name: '#desert', category_id: 2, description: 'Пустынный ландшафт' },
        { id: 22, name: '#water', category_id: 2, description: 'Водные локации' },
        { id: 23, name: '#swamp', category_id: 2, description: 'Болотистая местность' },
        { id: 24, name: '#industrial', category_id: 2, description: 'Индустриальные локации' },
        { id: 25, name: '#ruins', category_id: 2, description: 'Руины и разрушенные здания' },
        { id: 26, name: '#castle', category_id: 2, description: 'Замки и крепости' },
        { id: 27, name: '#village', category_id: 2, description: 'Деревенские локации' },
        { id: 28, name: '#alien', category_id: 2, description: 'Инопланетные ландшафты' },
        
        // Краски и материалы - Paint Types
        { id: 29, name: '#acrylic', category_id: 3, description: 'Акриловые краски' },
        { id: 30, name: '#oil', category_id: 3, description: 'Масляные краски' },
        { id: 31, name: '#spray', category_id: 3, description: 'Краски в баллончиках' },
        { id: 32, name: '#glue', category_id: 3, description: 'Клеевые составы' },
        { id: 33, name: '#putty', category_id: 3, description: 'Шпатлевочные материалы' },
        { id: 34, name: '#primer', category_id: 3, description: 'Грунтовочные материалы' },
        { id: 35, name: '#varnish', category_id: 3, description: 'Лаки и финишные покрытия' },
        { id: 36, name: '#wash', category_id: 3, description: 'Восхи и фильтры' },
        { id: 37, name: '#drybrush', category_id: 3, description: 'Материалы для сухой кисти' },
        { id: 38, name: '#airbrush', category_id: 3, description: 'Аэрограф и материалы' },
        { id: 39, name: '#metallic', category_id: 3, description: 'Металлические краски' },
        { id: 40, name: '#fluorescent', category_id: 3, description: 'Флуоресцентные краски' },
        { id: 41, name: '#contrast', category_id: 3, description: 'Контрастные краски' },
        { id: 42, name: '#speedpaint', category_id: 3, description: 'Спидпейнт краски' },
        
        // Книги и правила - Book Types
        { id: 43, name: '#rulebook', category_id: 4, description: 'Игровые правила' },
        { id: 44, name: '#campaign', category_id: 4, description: 'Игровые кампании' },
        { id: 45, name: '#fiction', category_id: 4, description: 'Художественная литература' },
        { id: 46, name: '#magazine', category_id: 4, description: 'Игровые журналы' },
        { id: 47, name: '#codex', category_id: 4, description: 'Кодексы и армбуки' },
        { id: 48, name: '#scenario', category_id: 4, description: 'Сценарии и миссии' },
        { id: 49, name: '#lore', category_id: 4, description: 'Лор и история вселенной' },
        { id: 50, name: '#artbook', category_id: 4, description: 'Артбуки и концепт-арт' },
        
        // Аксессуары - Accessory Types
        { id: 51, name: '#dice', category_id: 5, description: 'Игровые кубики' },
        { id: 52, name: '#cards', category_id: 5, description: 'Игровые карты' },
        { id: 53, name: '#tokens', category_id: 5, description: 'Игровые жетоны' },
        { id: 54, name: '#measuring', category_id: 5, description: 'Измерительные инструменты' },
        { id: 55, name: '#bags', category_id: 5, description: 'Сумки для переноски' },
        { id: 56, name: '#storage', category_id: 5, description: 'Хранение и организация' },
        { id: 57, name: '#bases', category_id: 5, description: 'Подставки для миниатюр' },
        { id: 58, name: '#movement', category_id: 5, description: 'Инструменты для движения' },
        { id: 59, name: '#weathering', category_id: 5, description: 'Материалы для состаривания' },
        { id: 60, name: '#basing', category_id: 5, description: 'Материалы для баз' },
        
        // Электроника - Electronic Components
        { id: 61, name: '#arduino', category_id: 6, description: 'Платы Arduino' },
        { id: 62, name: '#raspberrypi', category_id: 6, description: 'Платы Raspberry Pi' },
        { id: 63, name: '#sensors', category_id: 6, description: 'Электронные сенсоры' },
        { id: 64, name: '#motors', category_id: 6, description: 'Электродвигатели' },
        { id: 65, name: '#led', category_id: 6, description: 'Светодиоды и подсветка' },
        { id: 66, name: '#battery', category_id: 6, description: 'Батареи и источники питания' },
        { id: 67, name: '#wiring', category_id: 6, description: 'Провода и соединения' },
        { id: 68, name: '#switches', category_id: 6, description: 'Переключатели и кнопки' },
        { id: 69, name: '#sound', category_id: 6, description: 'Звуковые модули' },
        { id: 70, name: '#bluetooth', category_id: 6, description: 'Bluetooth модули' },
        { id: 71, name: '#wifi', category_id: 6, description: 'WiFi модули' },
        
        // Другое - Miscellaneous
        { id: 72, name: '#3dprinting', category_id: 7, description: '3D принтеры и расходники' },
        { id: 73, name: '#tools', category_id: 7, description: 'Ручные инструменты' },
        { id: 74, name: '#clothing', category_id: 7, description: 'Игровая одежда и костюмы' },
        { id: 75, name: '#gifts', category_id: 7, description: 'Подарочные наборы' },
        { id: 76, name: '#kickstarter', category_id: 7, description: 'Kickstarter проекты' },
        { id: 77, name: '#limited', category_id: 7, description: 'Лимитированные издания' },
        { id: 78, name: '#exclusive', category_id: 7, description: 'Эксклюзивные товары' },
        { id: 79, name: '#vintage', category_id: 7, description: 'Винтажные и коллекционные' },
        { id: 80, name: '#custom', category_id: 7, description: 'Кастомные и уникальные' },
        { id: 81, name: '#handmade', category_id: 7, description: 'Ручная работа' },
        { id: 82, name: '#digital', category_id: 7, description: 'Цифровые товары' },
        { id: 83, name: '#subscription', category_id: 7, description: 'Подписки и боксы' },
        { id: 84, name: '#preorder', category_id: 7, description: 'Предзаказы' }
      ]);
    });
};
