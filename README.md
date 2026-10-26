# Loadout Lab · CS2

Planificador personal de skins con equipamiento CT/T, comparación actual/deseada y conjuntos guardados.

- Web: https://deinszxcq.github.io/cs2-loadout-lab/
- Interfaz estática: `dist/`; GitHub Actions publica esa carpeta cuando se actualiza `main`.
- Inicio de sesión: GitHub OAuth mediante Supabase Auth (PKCE).
- Sin cuenta: los conjuntos se guardan solo en el navegador.
- Con cuenta: equipamiento y conjuntos se guardan en Supabase y se recuperan al volver a entrar. Cada fila está protegida por RLS y `auth.uid() = user_id`.
- Las selecciones se sincronizan de forma secuencial. Si se edita desde varios dispositivos a la vez, prevalece el último guardado. Para recargar cambios de otro dispositivo: Mi cuenta > Volver a cargar desde la nube.
- Mi cuenta permite importar los conjuntos locales sin borrar las copias del navegador. La importación se identifica por cuenta para evitar duplicados.

## Vista de equipamiento

La pantalla inicial muestra CT y T con 15 armas en tres columnas y accesos a guantes, cuchillo y Zeus. «Lo que tengo» y «Lo que me gustaría» mantienen distribuciones separadas. Cada casilla abre un selector de arma y acabado; las restricciones de equipo y de pistola inicial se validan antes de aplicar. Elegir un arma que ya ocupa otra casilla intercambia sus posiciones.

La distribución se guarda dentro de `equipment.__layout` y conserva el formato previo de selecciones por arma. Los conjuntos existentes reciben una distribución inicial al cargarse, sin modificar sus skins. Guardar un equipo conserva ambas vistas.

## Agentes

El catálogo incluye 63 agentes (29 CT y 34 T) con sus imágenes oficiales de inventario descargadas en `dist/assets/agents/`. El selector se abre desde la imagen, el icono del agente o «Cambiar agente». Permite buscar por nombre, facción y colección, previsualizar, equipar y quitar la selección. Cada equipo conserva un agente actual y uno deseado de forma independiente, dentro de `equipment.__agent`. Esa información se guarda también en los conjuntos y se sincroniza con la cuenta.

Las imágenes oficiales son retratos de inventario. Cuando no hay ningún agente seleccionado, se muestran los recortes recreados a partir de las capturas de referencia. Todas son imágenes estáticas; no representan el arma equipada ni un visor 3D.

Actualizar agentes: `node scripts/update-agents.mjs`. Comprobar catálogo, persistencia y restricciones: `node --test tests/agents.test.mjs`.

## Desarrollo

Ejecutar `node scripts/serve.mjs` para servir `dist/` mediante HTTP. La URL local de autenticación permitida es `http://127.0.0.1:4173/`.

`dist/cloud-config.js` contiene únicamente la URL y la clave **publicable** de Supabase. Nunca añadir claves `service_role`, claves secretas ni el secreto OAuth de GitHub. El secreto OAuth está configurado solo en Supabase.

Proyecto Supabase: `agysrwrjtyotxdbirdwm` (organización Deins). La migración de `supabase/migrations/` corresponde a la versión aplicada en ese proyecto. No volver a aplicarla manualmente a la misma base de datos.

La aplicación OAuth de GitHub usa como callback `https://agysrwrjtyotxdbirdwm.supabase.co/auth/v1/callback`. El proveedor debe permanecer habilitado en Supabase. No se solicita acceso a repositorios.

## Validación de cuentas

Verificado con dos cuentas temporales: autenticación real, guardado y recuperación del equipamiento y conjuntos, cierre de sesión e importación local. La API impide lecturas, actualizaciones, eliminaciones e inserciones con propietario ajeno. Las peticiones sin autenticar no tienen permisos sobre las tablas. Se eliminaron las cuentas de prueba tras la verificación.

## Catálogo y dependencias

Catálogo ampliado: 63 modelos (35 armas, 20 cuchillos y 8 familias de guantes), 2.106 acabados y 63 opciones sin skin. Incluye los 52 acabados de AWP. Las fases Doppler se muestran por separado. Imágenes de referencia de Valve, catálogo de [ByMykel/CSGO-API](https://github.com/ByMykel/CSGO-API). Las imágenes nuevas se cargan bajo demanda desde Steam; las 96 imágenes iniciales siguen incluidas localmente. El agente es una imagen fija; no hay integración con el inventario de Steam ni visor 3D.

Cada modelo tiene un enlace de consulta a Pricempire. El catálogo se obtiene de los archivos públicos de ByMykel/CSGO-API, no de la API de Pricempire: esa API requiere una cuenta y una clave. No se incluyen precios ni se incrustan claves de Pricempire en el navegador.

Para actualizar el catálogo: `node scripts/update-catalog.mjs`. Para validar cobertura, equipos y compatibilidad con selecciones anteriores: `node --test tests/catalog.test.mjs tests/loadout-layout.test.mjs tests/agents.test.mjs`. Los identificadores originales se mantienen para conservar conjuntos locales y de Supabase.

Supabase JS 2.118.0 está incluido en `dist/vendor/`, con su licencia MIT. SHA-256 del archivo UMD: `ee3be8de192b97cb1d73d1e95d6b82bb1f6b658c0f97c4ef757fc331996ed3d3`. Fuente: https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.js

Las vistas grandes usan renders de cuerpo completo de CSGOSKINS.GG; los iconos laterales mantienen el retrato correspondiente. Actualizar renders: `node scripts/fetch-full-agents.mjs` y `python scripts/encode-full-agents.py` (Pillow). Fuente de ejemplo: https://csgoskins.gg/items/number-k-the-professionals

## Agentes y todos los guantes en 3D

El visor incluye los 63 agentes de CT/T, las 8 familias y los 94 acabados del catálogo, además de los 8 modelos base. Bloodhound, Broken Fang, Driver, Hand Wraps, Hydra, Moto, Specialist y Sport usan su propia geometría original. El menú permite cambiar equipo, agente, familia y acabado, girar y acercarse al guante. Al aplicar, se actualizan la vista grande y el icono lateral, en la capa Actual/Deseado abierta. Los conjuntos y la sincronización usan el formato existente. Cerrar sin aplicar no modifica la selección.

Los modelos se cargan bajo demanda. Las vistas principales de ambos equipos muestran los guantes seleccionados sobre el agente. Si falla WebGL o una descarga, conservan la imagen estática. Los recursos GPU se liberan al cerrar o cambiar modelo y el visor solo dibuja al cambiar cámara, tamaño o material.

Los materiales PBR se preparan desde las paletas, máscaras, patrones, tela, cuero, normales, oclusión y metal de CS2. También se interpretan las nuevas composiciones de `volatile_02`. La iluminación ambiental aporta reflejos y la ropa mantiene una rugosidad mínima. Es una adaptación web: no reproduce el compositor completo de Source 2 ni simula float, desgaste o semillas. No hay armas 3D en esta versión.

Reconstrucción desde CS2 local (solo lectura):

1. Instalar la [CLI oficial Source 2 Viewer 20.1](https://github.com/ValveResourceFormat/ValveResourceFormat/releases/tag/20.1) en `.local-tools/source2viewer/`.
2. `node scripts/export-all-agent-assets.mjs`. Para otra instalación, definir `CS2_GAME_DIR` con la ruta a `game/csgo`. El script descarga los catálogos públicos si faltan en la caché local.
3. `python scripts/build-all-agent-assets.py` (Pillow y NumPy). `--repack` reconstruye modelos ya empaquetados.
4. `node --test tests/*.test.mjs`. Verifica las 504 combinaciones de articulaciones, cobertura de acabados y guardado independiente por equipo/vista.

Solo se publican los modelos y materiales compactos de `dist/assets/equipment-3d/` y su manifiesto. Las texturas embebidas usan EXT_texture_webp para navegadores modernos. Herramientas y exportaciones de trabajo quedan ignoradas. Modelos/texturas originales: Valve / Counter-Strike 2. Three.js 0.180.0 conserva su licencia MIT en `dist/vendor/three/LICENSE`.


### Poses y ojos

La presentación conserva una pose de inventario nativa por agente (14 secuencias compartidas). Las rotaciones se aplican como diferencias respecto a la pose base de cada esqueleto, sin sustituir sus proporciones ni reorientar la raíz. Los cinco profesionales cuyo esquema apunta a la secuencia antigua ausente `cu_t_pose05` reutilizan `cu_t_pose04` de la misma familia. Cambiar guantes conserva la postura.

Las 42 superficies de cara con `F_EYEBALLS` usan una textura adicional que combina el albedo original del ojo, su máscara, el tamaño de iris/pupila y la posición de los huesos oculares. La mirada está fijada al frente del rostro; no simula el seguimiento ocular dinámico de Source 2. «Rostro» permite revisar el resultado. Los agentes enmascarados sin esa capa mantienen su material original.

`python scripts/build-agent-presentations.py` reconstruye las poses y las texturas de ojos sin volver a empaquetar los modelos grandes. El proceso general de materiales lo ejecuta al terminar. Algoritmo de referencia para los parámetros oculares: [Source 2 Viewer](https://github.com/ValveResourceFormat/ValveResourceFormat/blob/master/Renderer/Shaders/features/csgo_character_eyes_ps.slang).
