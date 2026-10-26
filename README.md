# Loadout Lab · CS2

Planificador personal de skins con equipamiento CT/T, comparación actual/deseada y conjuntos guardados.

- Web: https://deinszxcq.github.io/cs2-loadout-lab/
- Interfaz estática: `dist/`; GitHub Actions publica esa carpeta cuando se actualiza `main`.
- Inicio de sesión: GitHub OAuth mediante Supabase Auth (PKCE).
- Sin cuenta: los conjuntos se guardan solo en el navegador.
- Con cuenta: equipamiento y conjuntos se guardan en Supabase y se recuperan al volver a entrar. Cada fila está protegida por RLS y `auth.uid() = user_id`.
- Las selecciones se sincronizan de forma secuencial. Si se edita desde varios dispositivos a la vez, prevalece el último guardado. Para recargar cambios de otro dispositivo: Mi cuenta > Volver a cargar desde la nube.
- Mi cuenta permite importar los conjuntos locales sin borrar las copias del navegador. La importación se identifica por cuenta para evitar duplicados.

## Desarrollo

Servir `dist/` mediante HTTP. La URL local de autenticación permitida es `http://127.0.0.1:4173/`.

`dist/cloud-config.js` contiene únicamente la URL y la clave **publicable** de Supabase. Nunca añadir claves `service_role`, claves secretas ni el secreto OAuth de GitHub. El secreto OAuth está configurado solo en Supabase.

Proyecto Supabase: `agysrwrjtyotxdbirdwm` (organización Deins). La migración de `supabase/migrations/` corresponde a la versión aplicada en ese proyecto. No volver a aplicarla manualmente a la misma base de datos.

La aplicación OAuth de GitHub usa como callback `https://agysrwrjtyotxdbirdwm.supabase.co/auth/v1/callback`. El proveedor debe permanecer habilitado en Supabase. No se solicita acceso a repositorios.

## Validación de cuentas

Verificado con dos cuentas temporales: autenticación real, guardado y recuperación del equipamiento y conjuntos, cierre de sesión e importación local. La API impide lecturas, actualizaciones, eliminaciones e inserciones con propietario ajeno. Las peticiones sin autenticar no tienen permisos sobre las tablas. Se eliminaron las cuentas de prueba tras la verificación.

## Catálogo y dependencias

Catálogo ampliado: 63 modelos (35 armas, 20 cuchillos y 8 familias de guantes), 2.106 acabados y 63 opciones sin skin. Incluye los 52 acabados de AWP. Las fases Doppler se muestran por separado. Imágenes de referencia de Valve, catálogo de [ByMykel/CSGO-API](https://github.com/ByMykel/CSGO-API). Las imágenes nuevas se cargan bajo demanda desde Steam; las 96 imágenes iniciales siguen incluidas localmente. El agente es una imagen fija; no hay integración con el inventario de Steam ni visor 3D.

Cada modelo tiene un enlace de consulta a Pricempire. El catálogo se obtiene de los archivos públicos de ByMykel/CSGO-API, no de la API de Pricempire: esa API requiere una cuenta y una clave. No se incluyen precios ni se incrustan claves de Pricempire en el navegador.

Para actualizar el catálogo: `node scripts/update-catalog.mjs`. Para validar cobertura, equipos y compatibilidad con selecciones anteriores: `node --test tests/catalog.test.mjs`. Los identificadores originales se mantienen para conservar conjuntos locales y de Supabase.

Supabase JS 2.118.0 está incluido en `dist/vendor/`, con su licencia MIT. SHA-256 del archivo UMD: `ee3be8de192b97cb1d73d1e95d6b82bb1f6b658c0f97c4ef757fc331996ed3d3`. Fuente: https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.js
