<?php
require __DIR__ . "/../app/bootstrap.php";
?>
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>IAstronaut VR</title>
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
  <script type="module">
    import * as THREE from "three";
    import { VRButton } from "three/addons/webxr/VRButton.js";

    window.THREE = THREE;
    window.VRButton = VRButton;
  </script>

  <script type="module" src="<?= asset('js/iastronaut/threeScene.js') ?>"></script>
</body>
</html>
