<?php
declare(strict_types=1);

function e(?string $value): string
{
  return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
}

function app_base_path(): string
{
  $base = defined('BASE_PATH') ? (string) BASE_PATH : '';
  $base = rtrim(str_replace('\\', '/', $base), '/');
  return $base === '/' ? '' : $base;
}

function url(string $path = ''): string
{
  $base = app_base_path();
  $path = trim($path);
  if ($path === '') return $base === '' ? '/' : $base . '/';
  return $base . '/' . ltrim($path, '/');
}

function asset(string $path): string
{
  return url('assets/' . ltrim($path, '/'));
}
