# Сторонние компоненты и данные

Проект «ГеоСлед» включает локальные копии стороннего программного обеспечения, наборов данных и шрифтов. Лицензия MIT из файла [`LICENSE`](./LICENSE) относится только к авторской части проекта и не отменяет приведённые ниже условия.

## Leaflet 1.9.4

- Назначение: отображение и управление интерактивной картой.
- Включённые файлы: `vendor/leaflet/leaflet.js`, `vendor/leaflet/leaflet.css`.
- Авторы: Volodymyr Agafonkin, CloudMade и участники проекта Leaflet.
- Проект: <https://leafletjs.com/>.
- Лицензия: BSD 2-Clause.
- Полный текст: [`licenses/LEAFLET-BSD-2.txt`](./licenses/LEAFLET-BSD-2.txt).

## TopoJSON Client 3.1.0

- Назначение: преобразование TopoJSON-геометрии карты в GeoJSON в браузере.
- Включённый файл: `vendor/topojson/topojson-client.min.js`.
- Автор: Michael Bostock.
- Проект: <https://github.com/topojson/topojson-client>.
- Лицензия: ISC.
- Полный текст: [`licenses/TOPOJSON-ISC.txt`](./licenses/TOPOJSON-ISC.txt).

## World Atlas 2.0.2 и Natural Earth

- Назначение: геометрия границ стран в файле `data/countries-50m.json`.
- Источник: `world-atlas` 2.0.2, удобная TopoJSON-републикация данных Natural Earth 4.1.0 масштаба 1:50m.
- Проект World Atlas: <https://github.com/topojson/world-atlas>.
- Исходные данные Natural Earth: <https://www.naturalearthdata.com/>.
- Лицензия World Atlas: ISC; полный текст находится в [`licenses/WORLD-ATLAS-ISC.txt`](./licenses/WORLD-ATLAS-ISC.txt).
- Данные Natural Earth предоставляются как public domain согласно условиям их поставщика.

Геометрия в проекте адаптирована для игры и сопоставлена с кодами стран. Отображение границ носит учебный характер и не выражает позицию авторов проекта относительно статуса территорий или границ.

## World Countries 5.1.0

- Назначение: базовые сведения о странах, использованные при подготовке `data/countries.json`.
- Проект: <https://github.com/mledoze/countries>.
- Версия источника: 5.1.0.
- Лицензия базы данных: Open Data Commons Open Database License (ODbL) 1.0.
- Полный текст: [`licenses/WORLD-COUNTRIES-ODBL.txt`](./licenses/WORLD-COUNTRIES-ODBL.txt).

Файл `data/countries.json` является адаптированной базой данных. В той мере, в какой к нему применима ODbL, он предоставляется на условиях ODbL 1.0; при публичном использовании или дальнейшем распространении следует сохранять атрибуцию, уведомление о лицензии и выполнять требования ODbL к производным базам данных.

## Wikidata

Русские и английские подписи стран и столиц в `data/countries.json` дополнены по результатам запросов Wikidata SPARQL. Структурированные данные Wikidata доступны по лицензии Creative Commons CC0 1.0 Universal.

- Проект: <https://www.wikidata.org/>.
- Условия: <https://www.wikidata.org/wiki/Wikidata:Licensing>.

## Manrope

- Назначение: основной шрифт интерфейса.
- Включённые файлы: `assets/fonts/manrope-cyrillic.woff2`, `assets/fonts/manrope-latin.woff2`.
- Пакет-источник: `@fontsource-variable/manrope` 5.2.8.
- Авторы: The Manrope Project Authors.
- Проект: <https://fontsource.org/fonts/manrope>.
- Лицензия: SIL Open Font License 1.1.
- Полный текст: [`licenses/MANROPE-OFL.txt`](./licenses/MANROPE-OFL.txt).

## Roboto Condensed

- Назначение: акцентный и заголовочный шрифт интерфейса.
- Включённые файлы: `assets/fonts/roboto-condensed-cyrillic.woff2`, `assets/fonts/roboto-condensed-latin.woff2`.
- Пакет-источник: `@fontsource-variable/roboto-condensed` 5.2.8.
- Авторские права: Google Inc. и участники проекта шрифта.
- Проект: <https://fontsource.org/fonts/roboto-condensed>.
- Лицензия: SIL Open Font License 1.1.
- Полный текст: [`licenses/ROBOTO-CONDENSED-OFL.txt`](./licenses/ROBOTO-CONDENSED-OFL.txt).

## Сводка лицензий

| Материал | Версия | Лицензия |
| --- | ---: | --- |
| Leaflet | 1.9.4 | BSD 2-Clause |
| TopoJSON Client | 3.1.0 | ISC |
| World Atlas | 2.0.2 | ISC |
| Natural Earth | 4.1.0 | Public domain |
| World Countries | 5.1.0 | ODbL 1.0 |
| Wikidata structured data | снимок от 2026-09-02 | CC0 1.0 |
| Manrope via Fontsource | 5.2.8 | SIL OFL 1.1 |
| Roboto Condensed via Fontsource | 5.2.8 | SIL OFL 1.1 |
