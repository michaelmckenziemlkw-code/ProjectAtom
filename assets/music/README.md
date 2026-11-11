# WormTheme

`source/WormTheme.mid` — исходное авторское исполнение пользователя на Kawai. Сохранено без изменений: 517 нот, 352 события педали, MIDI format 0, PPQ 1920, темп карты 120 BPM, последняя MIDI-отметка 131,173958 с. Живые отклонения длительностей и динамики сохранены; темп не выравнивался.

`../../public/music/WormTheme.ogg` — готовое стереофортепиано 44,1 кГц, около 134,174 с с трёхсекундным хвостом затухания. Это тембр виртуального инструмента, не аудиозапись звука Kawai. Метаданные и SHA-256 исходника — `WormTheme.json`; длительность синематика берётся из этого файла.

Инструмент технической пробы: TimGM6mb Acoustic Grand Piano, Tim Brechbill / David Bolton; SoundFont имеет лицензию GPL-2, атрибуция и полный текст приложены в `licenses/`. Сам SoundFont не включён в репозиторий. Авторство пользовательской композиции и исполнения остаётся за пользователем. Исходный MIDI не заменяется рендером.

## Повторный рендер

Нужны Python 3, системная libfluidsynth, FFmpeg и установленный TimGM6mb SoundFont. Скрипт не требует Python-пакетов, сохраняет ноты, velocity, note-off, контроллеры педали и карту темпа, выбирает Acoustic Grand Piano (GM program 0). Sysex настройки конкретного цифрового пианино в тембр не переносятся.

```sh
python3 scripts/test_render_midi.py
python3 scripts/render_midi.py assets/music/source/WormTheme.mid /tmp/WormTheme.wav /usr/share/sounds/sf2/TimGM6mb.sf2 > assets/music/WormTheme.json
ffmpeg -y -i /tmp/WormTheme.wav -c:a libvorbis -q:a 5 public/music/WormTheme.ogg
```

Рендер имеет запас по уровню: пиковая амплитуда PCM около 0,159; музыка в игре проходит через gain 2,2 и общий регулятор громкости. Старый синтезированный мотив в прологе удалён; шумовой кашель остаётся отдельным эффектом.
