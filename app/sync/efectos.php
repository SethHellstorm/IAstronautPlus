<?php
declare(strict_types=1);
function efectoSync(mixed $nombre, mixed $escena): array
{
    $perfiles = json_decode(file_get_contents(dirname(__DIR__, 2) . '/public/sync/efectos.json'), true, 512, JSON_THROW_ON_ERROR);
    $escenas = ['earth', 'sun', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'moon', 'corona', 'pluto'];
    if (!is_string($nombre) || !isset($perfiles[$nombre]) || !is_string($escena) || !in_array($escena, $escenas, true)) {
        throw new InvalidArgumentException('Efecto o destino no valido.');
    }
    return ['efecto' => $nombre, 'escena' => $escena, 'duration' => $perfiles[$nombre]['duration'],
        'mensaje' => $nombre . ' (' . $perfiles[$nombre]['duration'] . ' ms, simulacion)'];
}
