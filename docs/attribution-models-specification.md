# Atribución configurable: último clic por defecto y primer clic opcional

Fecha: 2026-10-20. Base analizada: plugin 0.8.0.
Estado: propuesta para revisión e implementación; este documento no modifica el comportamiento del plugin.

## 1. Objetivo y alcance

Permitir que el administrador elija qué origen aparece en el mensaje de WhatsApp:

- **Último clic**, seleccionado por defecto: conserva la entrada identificable más reciente.
- **Primer clic**, opcional: conserva la primera entrada identificable durante su vigencia.

Ambos modelos mantienen una retención de 7 días y las integraciones actuales: botón flotante, selector CSS, shortcode y Joinchat. La elección es global para el sitio. El objetivo es que el administrador entienda qué pregunta responde cada modelo antes de guardar la configuración.

Este feature no incorpora historial de visitas, atribución simultánea, reparto de crédito, analítica de conversiones ni duración configurable. El clic en WhatsApp prepara un mensaje; no acredita que se haya enviado ni que exista una venta.

## 2. Hallazgos en el código actual

| Componente | Comportamiento verificado en 0.8.0 |
|---|---|
| `includes/class-capysele-settings.php` | Retención centralizada de 7 días; no existe opción de modelo. |
| `public/public.js`: `getParams()` / `hasAttributionData()` | Captura cinco UTMs, cuatro click IDs y referente externo. URL y fecha por sí solas no constituyen atribución. |
| `saveData()` | Si existe una captura válida, la devuelve íntegra y descarta señales nuevas: primer clic estricto. |
| `isValidRecord()` / `getValidStored()` | Vigencia `captured_at <= ahora < captured_at + TTL`; limpia registros vencidos, corruptos o con fecha inválida/futura. |
| `getClickData()` | Revalida al clic y consulta el almacenamiento compartido; no vuelve a capturar los parámetros de una pestaña antigua. |
| `classifyChannel()` | Clasifica el registro elegido, incluyendo canales de IA. Elegir un modelo no requiere modificar estas reglas. |
| `admin/settings-page.php` | Setup y ayudas afirman que siempre se conserva la primera visita. No hay wizard independiente. |
| `tests/public.test.js` | Suite con `node:test`, reloj fijo y simulación de navegador; cubre primer clic, vencimiento, IA, placeholders y botones. |

La especificación MVP de `.claude/project-specification.md` es histórica y contiene reglas anteriores a 0.8.0. Este documento define la propuesta nueva y toma el código actual como base. `.claude/` está ignorado por Git; esta especificación se ubica en `docs/` para poder versionarse.

## 3. Decisiones propuestas y justificación

Las siguientes decisiones completan detalles no definidos expresamente en la solicitud. Deben revisarse junto con el feature antes de implementar.

### 3.1 Qué significa «clic»

En la interfaz se usarán «último clic» y «primer clic», acompañados de «entrada identificable». Técnicamente se observan señales al cargar la página, no el clic original en la plataforma de origen. 

Una entrada identificable es una carga de página con al menos un UTM no vacío, un click ID no vacío o un referente externo aceptado por la función actual. Se preserva el criterio actual de referente externo por origen (`origin`); no se amplía la detección de dominios/subdominios.

Se propone **último clic identificable**, excluyendo visitas sin señales. Una visita directa o navegación interna sin parámetros no reemplaza una campaña vigente. Esto mantiene el comportamiento actual ante falta de señales y evita borrar información útil. Debe explicarse expresamente: no es un modelo en el que una visita directa sustituye al origen anterior.

No se añade detección de sesiones ni deduplicación de entradas: recargar una URL que conserva UTMs/click IDs vuelve a ser una captura identificable. En último clic actualiza la fecha, incluso si la campaña es la misma. También ocurre si esos parámetros se propagan a enlaces internos. Una recarga sin señales no renueva la vigencia.

### 3.2 Ventana de siete días

- **Primer clic:** siete días desde la captura inicial. Las entradas posteriores no reemplazan datos ni renuevan la fecha.
- **Último clic:** siete días desde la última captura identificable. Cada captura nueva reemplaza el registro completo y reinicia su vigencia.
- Navegación sin señales y clics en WhatsApp no renuevan la fecha en ningún modelo.
- Al alcanzar exactamente el límite, la captura ya no es válida. Si no hay una entrada nueva, el mensaje se genera sin atribución.

La ventana de último clic puede prolongarse con sucesivas entradas identificables. Mantener siempre el vencimiento de la primera captura haría que una campaña recién capturada pudiera desaparecer en minutos; por eso se propone anclarlo a la captura seleccionada.

### 3.3 Actualizaciones de instalaciones existentes

Se propone que una configuración sin modelo guardado resuelva a `last_click`, tanto en instalaciones nuevas como al actualizar. Una elección explícita válida de `first_click` se conserva. Esto cumple un único valor por defecto sin introducir una migración que mantenga silenciosamente primer clic en sitios antiguos.

**Impacto:** las campañas posteriores podrán sustituir la atribución en sitios actualizados sin intervención del administrador. El cambio debe aparecer en las notas de actualización, el setup y el readme. Si se decide preservar primer clic en instalaciones antiguas, esa alternativa requiere cambiar esta regla y sus pruebas antes de implementar.

## 4. Reglas funcionales

En todos los casos, «registro vigente» significa que supera la validación temporal y tiene señales de atribución.

| Registro guardado | Entrada actual | Primer clic | Último clic |
|---|---|---|---|
| Ausente o inválido | Sin señales | Sin atribución | Sin atribución |
| Ausente o inválido | Identificable A | Guardar A | Guardar A |
| Vigente A | Sin señales | Conservar A y su fecha | Conservar A y su fecha |
| Vigente A | Identificable B | Conservar A y su fecha | Reemplazar por B y su fecha |
| Vencido A | Identificable B | Limpiar A y guardar B | Limpiar A y guardar B |
| Vencido A | Sin señales | Limpiar A; sin atribución | Limpiar A; sin atribución |

### Integridad del registro

El reemplazo es completo, sin mezclar campos entre visitas. Si A incluye Google Ads, `gclid` y campaña A, y B solo un referente de ChatGPT, el resultado de último clic es B sin los UTMs ni el `gclid` de A. La clasificación se calcula usando únicamente ese registro. Un UTM parcial también cuenta como señal conforme al comportamiento actual; no autoriza rellenar sus campos con datos anteriores.

### Cambios de modelo y compatibilidad del navegador

- Mantener una única clave `capysele_data` y el formato actual; no hace falta una tabla de base de datos ni almacenar ambos modelos.
- Conservar una captura heredada vigente con su fecha original. No borrarla ni reiniciar sus siete días solo por actualizar o cambiar de modelo.
- De primer a último clic: conservar la captura hasta que venza o llegue otra identificable.
- De último a primer clic: conservar la captura vigente como punto de partida y dejar de sustituirla hasta su vencimiento. No es posible reconstruir una primera visita histórica que no se almacenó.
- No recalcular mensajes ya enviados ni afirmar que se reconstruye el recorrido previo.
- Las páginas cargadas después de guardar reciben la nueva configuración. Las pestañas abiertas conservan la configuración que recibieron hasta recargarse; avisar que se deben recargar para probar un cambio. No añadir sincronización de configuración entre pestañas en este alcance.
- En pestañas con la misma configuración, el clic lee la captura vigente compartida, como hoy. Las cargas concurrentes mantienen la semántica actual de escrituras en localStorage; no se promete ordenación transaccional de visitas simultáneas.
- Si localStorage falla, mantener el fallback actual a memoria de la página y su vencimiento; no prometer persistencia entre páginas.

### Placeholders

`{channel}`, UTMs, IDs y `{referrer}` corresponden al registro seleccionado. `{captured_at}` corresponde a su fecha: inicial en primer clic y más reciente en último clic.

`{exit_page}` y `{exit_page_title}` siguen resolviéndose al clic. `{landing_page}` conserva su comportamiento de alias heredado de `{exit_page}`, aunque el registro interno contenga la URL de captura. No modificar plantillas guardadas.

Compatibilidad: sin registro, el código actual utiliza la hora del clic como fallback para `{captured_at}` y mantiene esa línea. Se conserva esa excepción y se explica en la referencia; no presentarla como evidencia de una captura real. Las demás líneas sin señales mantienen las reglas actuales de eliminación.

## 5. Configuración y setup

Agregar un campo visible «Modelo de atribución» en la sección 3, antes de la plantilla del mensaje. Usar un grupo de dos radios con etiqueta accesible y ayuda asociada; mostrar siempre la explicación de ambas opciones. No ubicarlo únicamente en «Avanzado».

Texto propuesto en español:

> **Último clic (predeterminado)**  
> Atribuye el contacto al origen identificable más reciente antes del clic en WhatsApp. Cada nueva entrada con UTMs, identificadores de anuncios o un referente externo reemplaza la anterior y se conserva durante 7 días desde esa captura. Úsalo para conocer qué origen precedió al contacto.
>
> **Primer clic**  
> Atribuye el contacto al primer origen identificable capturado. Lo conserva durante 7 días desde esa captura, aunque después lleguen otras campañas. Úsalo para conocer el origen inicial dentro de ese período.
>
> **Ejemplo:** una persona llega desde Google Ads el lunes, vuelve desde ChatGPT el miércoles y hace clic en WhatsApp el jueves. Último clic muestra ChatGPT; primer clic muestra Google Ads. Navegar entre páginas o volver sin señales de origen no borra una atribución vigente.
>
> Los datos se guardan por navegador y dispositivo. Cambiar de modelo no recupera visitas anteriores que no se hayan guardado. Para probar un cambio, guarda los ajustes y recarga la página del sitio.

La interfaz fuente continúa en inglés con el text domain existente `capybara-seo-lead-source-tracker`. Equivalentes para los títulos: “Attribution model”, “Last click (default)” y “First click”. Traducir la explicación completa a es_ES y es_PE, incluyendo el ejemplo y las limitaciones; regenerar POT/PO/MO con las herramientas del proyecto disponibles al implementar.

Actualizar también:

1. Introducción del panel: indicar que el modelo es configurable.
2. «Quick setup»: añadir elegir modelo y explicar su efecto antes del paso de prueba. Referenciar la sección 3.
3. «How the channel is detected»: sustituir la afirmación de que siempre describe la primera visita por «el origen seleccionado según el modelo configurado». Mantener la precedencia de clasificación.
4. «How long attribution is kept»: describir ambos relojes y la ausencia de renovación en visitas sin señales.
5. Referencia de placeholders: explicar `{captured_at}` y su fallback actual.
6. `readme.txt`: descripción, características, instalación, uso, FAQ de modelos, retención y notas de actualización. Conservar changelogs históricos como historia de versiones.

No crear un asistente adicional: el setup solicitado se integra en la pantalla y guía existentes. La ayuda debe poder entenderse sin consultar documentación externa.

## 6. Contrato técnico propuesto

### WordPress

Extender el array de `capysele_settings`:

```php
'attribution_model' => 'last_click', // last_click | first_click
```

- Añadir el default en `get_defaults()` y normalizar también al leer `get_settings()`; no confiar únicamente en la sanitización del formulario.
- Aceptar solo strings exactamente iguales a `last_click` o `first_click`. Ausencia, arrays, números u otros valores resuelven a `last_click` sin warnings.
- `sanitize_settings()` debe incluir la opción y conservar la elección válida enviada al guardar el formulario completo. No introducir una segunda opción global.
- Renderizar los radios mediante Settings API; conservar permisos `manage_options`, nonces y escape de los valores/textos.
- No depender de reactivar el plugin: una actualización normal debe aplicar el fallback al leer opciones antiguas. Preservar la migración existente de `mode` a toggles.
- Mantener la compatibilidad declarada de PHP 7.4 y WordPress 6.0; no añadir dependencias.

### Configuración pública

En `includes/class-capysele-plugin.php`, añadir al objeto localizado:

```js
attributionModel: 'last_click' // o 'first_click', ya validado en PHP
```

JavaScript debe validar de nuevo: solo `first_click` activa primer clic; `last_click`, ausencia o un valor inválido resuelven a último clic. Mantener `attributionTtlMs` y su fallback de siete días. Al publicar, incrementar la versión usada para invalidar la caché del script y documentar la purga de caché HTML para que la configuración nueva llegue al navegador.

### Selección de captura

Pseudocódigo orientativo para `saveData(current)`:

```js
const stored = getValidStored();
if (model === 'first_click' && stored) return stored;
if (!hasAttributionData(current)) return stored || {};
// Persistir current completo; si falla, usarlo en memoria como hoy.
persist(current);
return current;
```

`persist()` es solo una abreviación explicativa del bloque try/catch actual, no una nueva API exigida. Mantener el estilo del módulo: IIFE, `'use strict'`, JavaScript vanilla y funciones pequeñas. En PHP, seguir `CAPYSELE_Settings` y las convenciones existentes de campos y traducciones.

No recapturar al pulsar WhatsApp: `getClickData()` solo revalida/lee. Esto evita resucitar UTMs de una pestaña abierta una vez vencidos. Extender `debugInfo()` con `attribution_model`; conservar `channel_reason`, `captured_at` y `expires_at`, sin añadir llamadas de red.

## 7. Mapa de implementación y verificaciones

Esta secuencia orienta la implementación futura; no representa trabajo ya ejecutado.

| Orden | Archivos/componentes | Resultado verificable |
|---|---|---|
| 1 | `includes/class-capysele-settings.php` y pruebas PHP de opciones | Default, lectura y sanitización correctos; configuraciones antiguas y valores inválidos cubiertos. |
| 2 | `includes/class-capysele-plugin.php`, `public/public.js`, `tests/public.test.js` | Modelo localizado, selección íntegra, TTL y fallback funcionales. Las pruebas antiguas que exigen primer clic envían `attributionModel: 'first_click'` explícitamente. |
| 3 | `includes/class-capysele-settings.php`, `admin/settings-page.php` | Radios, guardado y setup comprensibles; ayudas consistentes. CSS solo si el grupo lo necesita. |
| 4 | `languages/`, `readme.txt`, versión del plugin | Traducciones y notas de cambio completas; ninguna afirmación general de primer clic obligatorio fuera del historial. |
| 5 | WordPress local y navegador real | Validación de los cuatro tipos de botón, actualización desde 0.8.0 y ambos modelos. |

No existe un runner PHP configurado en este repositorio. Añadir una prueba focalizada o usar un entorno WordPress de prueba para defaults, normalización, guardado y lectura; registrar el comando/entorno empleado al implementar. La suite JavaScript no sustituye esta comprobación.

Comandos existentes/aplicables desde la raíz:

```sh
node --test tests/public.test.js
git diff --check
php -l includes/class-capysele-settings.php
php -l includes/class-capysele-plugin.php
php -l admin/settings-page.php
php -l capybara-seo-lead-source-tracker.php
```

No hay build ni dependencias npm declaradas. Las pruebas de navegador necesitan WordPress con el plugin instalado; documentar su URL y procedimiento al ejecutar. Si se monta el repositorio en Docker, hacerlo en solo lectura y no eliminar el plugin desde wp-admin: el runbook local documenta una eliminación previa del código a través de un bind mount escribible.

## 8. Matriz de aceptación

Usar un reloj fijo y capturas A/B con campos distintos para detectar mezclas accidentales.

| ID | Escenario | Resultado esperado |
|---|---|---|
| A01 | Instalación nueva, ajustes antiguos sin clave, clave inválida; configuración JS ausente o inválida | Último clic efectivo en cada caso. |
| A02 | Guardar primer clic, volver a abrir ajustes y cargar frontend | Radio y configuración pública muestran `first_click`; guardar otros ajustes desde el formulario no lo revierte. |
| A03 | A Google Ads; dos días después B Meta Ads | Último clic usa solo B y vence siete días después de B; primer clic usa A y su vencimiento original. |
| A04 | A con UTMs y `gclid`; B solo con referente de IA o UTM parcial | Último clic elimina todos los campos exclusivos de A; primer clic conserva A íntegramente. |
| A05 | A vigente; navegación interna o visita directa sin parámetros | Ambos conservan A y no renuevan fecha. Sin A, no crean atribución ni canal Directo. |
| A06 | Un milisegundo antes del TTL, exactamente en TTL y después | Vigente solo antes del límite en ambos modelos. Sin señal nueva, elimina solo `capysele_data`. |
| A07 | Captura vencida + nueva entrada B | Ambos guardan B con nueva fecha. |
| A08 | JSON corrupto, fecha ausente/inválida/futura o registro sin señales | Descarta/limpia; puede capturar una entrada válida nueva. |
| A09 | Cambio de modelo con registro vigente, luego con registro vencido | Conserva fecha del vigente; no reconstruye historia. No recupera el vencido. |
| A10 | Recarga con los mismos UTMs; recarga posterior sin señales | Último clic renueva en la primera; primer clic no. Sin señales ninguno renueva. |
| A11 | Pestaña abierta más de siete días; clic con parámetros antiguos aún en URL | No recaptura ni usa registro vencido. |
| A12 | Storage bloqueado o fallo de escritura | No lanza errores; usa la captura efectiva en memoria mientras sea válida. |
| A13 | Clasificación de Google/Meta, orgánico, referral e IA | Mismas reglas sobre el registro seleccionado; dominios similares a IA no ganan clasificación falsa. |
| A14 | Dos pestañas con el mismo modelo; B guarda una nueva campaña y A hace clic | Lee la captura compartida vigente conforme al modelo; no renueva por el clic. |
| A15 | Flotante, selector, shortcode y Joinchat, en ambos modelos | Mismo origen efectivo y plantilla; número, escape URL, título/URL al clic y eliminación de líneas siguen funcionando. |
| A16 | Panel en inglés, es_ES y es_PE | Ambas opciones y ejemplo visibles, guardado correcto, navegación por teclado y textos traducidos sin contradicciones. |
| A17 | Actualización de 0.8.0 sin reactivación | Último clic por fallback, captura heredada aún vigente conservada hasta nueva señal; número, toggles y plantilla sin cambios. |
| A18 | Plantilla con `{captured_at}` y sin captura | Conserva la hora de fallback actual; la ayuda distingue este caso de una captura real. |

La aceptación requiere suite automatizada verde, comprobación de configuración PHP y evidencia en navegador de A02, A03, A05, A11, A15–A17. No borrar pruebas de primer clic para hacer pasar el nuevo default; parametrizarlas y mantener ambas ramas.

## 9. Límites y decisiones para la revisión

**Mantener siempre:** reemplazos íntegros, validación temporal al clic, siete días, datos locales por navegador, clasificación actual, traducciones y compatibilidad de plantillas.

**Revisar antes de implementar:** adopción automática de último clic en instalaciones existentes (3.3), exclusión de visitas sin señales (3.1), renovación por cada captura identificable y recargas (3.1–3.2). Son propuestas explícitas para resolver las ambigüedades del requerimiento.

**Fuera de alcance:** historial o almacenamiento simultáneo de primer/último clic, nueva base de datos, dependencias, duración editable, cambios de detección de canales y publicación del plugin. La implementación y el lanzamiento serán tareas posteriores a la revisión de esta especificación.
