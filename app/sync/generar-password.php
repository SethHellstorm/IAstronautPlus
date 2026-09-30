<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$password = stream_get_contents(STDIN);

// PowerShell añade un salto de línea al enviar el texto.
$password = preg_replace('/\r?\n\z/', '', $password);

if (strlen($password) < 12) {
    fwrite(STDERR, "Utiliza una contraseña de al menos 12 caracteres." . PHP_EOL);
    exit(1);
}

echo password_hash($password, PASSWORD_DEFAULT) . PHP_EOL;