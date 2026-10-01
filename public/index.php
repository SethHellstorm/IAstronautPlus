<?php
require __DIR__ . "/../app/bootstrap.php";
?>
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>IAstronaut VR</title>
  <link rel="icon" href="data:,">
  <style>
    html, body { margin:0; padding:0; width:100%; height:100%; overflow:hidden; background:#000; }
    canvas { display:block; width:100%; height:100%; }
  </style>
</head>
<body>
  <script>
    window.APP_BASE = "<?= e(app_base_path()) ?>";
  </script>
  <canvas id="renderCanvas"></canvas>

  
  <script type="importmap">
    {
      "imports": {
        "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
        "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
      }
    }
  </script>
  <div id="startupError" hidden style="position:fixed;inset:0;display:none;align-items:center;justify-content:center;padding:24px;background:#000;color:#e8faff;font:600 18px/1.5 system-ui,-apple-system,Segoe UI,Roboto,Arial;text-align:center;z-index:10000">
    <div style="max-width:560px;border:1px solid rgba(83,225,255,.35);border-radius:16px;padding:22px;background:rgba(7,18,34,.96)">
      No se pudo iniciar IAstronaut. Recarga la página; si el problema continúa, verifica la conexión y los archivos de la aplicación.
    </div>
  </div>
  <script type="module">
    Promise.all([
      import("three"),
      import("three/addons/webxr/VRButton.js")
    ]).then(([THREE, vrModule]) => {
      window.THREE = THREE;
      window.VRButton = vrModule.VRButton;
      return import("<?= asset('js/iastronaut/threeScene.js') ?>");
    }).catch((error) => {
      console.error("IAstronaut no pudo iniciar:", error);
      const fallback = document.getElementById("startupError");
      if (fallback) {
        fallback.hidden = false;
        fallback.style.display = "flex";
      }
    });
  </script>
</body>
</html>
