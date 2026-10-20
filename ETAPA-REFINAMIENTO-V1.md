# ETAPA-REFINAMIENTO-V1 — Plan de Refinamiento del Proyecto Subida (v3)

**Paradigma:** Sin IA. Sin Google Drive. Subida manual. Los tipos de documento EMERGEN de los documentos subidos, no se predefinen. El sistema agrupa páginas por similitud y el usuario nombra los grupos.

**Aislamiento:** Multi-tenant por unidad. La unidad se deriva del JWT que emite admincentral (`cod_unidad`). Un usuario solo ve y modifica datos de su unidad.

**Objetivo general:** Implementar autenticación vía JWT de admincentral con aislamiento por unidad, construir un motor de agrupamiento por firmas (palabras + estructura + pHash), rediseñar el flujo de subida como "lote → grupos → nombres", y habilitar aprendizaje incremental a partir de las confirmaciones humanas.

**Instrucciones para la IA generadora de código:**
- Cada fase es **independiente y ejecutable por separado**. No dependas de fases posteriores para completar una.
- Al terminar una fase, cambia su estado de `INCOMPLETO` a `COMPLETADO` en este mismo documento.
- No modifiques el alcance de otras fases. Si detectas que una fase requiere cambios de otra, documéntalo como nota y sigue.
- Ignora por completo la carpeta `core/` raíz. No la toques, no la integres, no la elimines.
- **No introduzcas IA generativa.** No hay Gemini, no hay OpenAI, no hay embeddings, no hay LLM. El agrupamiento es estadístico y determinista.
- **No introduzcas Google Drive ni proveedores externos de archivos.** La única entrada es subida manual por HTTP.
- Respeta el stack actual: Django 4.2.16, Strawberry GraphQL, PostgreSQL, MinIO, React 18 + Vite + TypeScript, Apollo Client.
- No introduzcas dependencias nuevas sin justificarlo (excepto `rapidfuzz`, `Pillow`, `imagehash` y `PyJWT`/`python-jose` cuando se indique).

---

## FASE 1 — Autenticación vía JWT de admincentral + aislamiento por unidad

**Estado:** `COMPLETADO`

**Prioridad:** 🔴 Crítica

**Objetivo:** Implementar la autenticación basada en el JWT que admincentral ya emite, crear el modelo `Unidad` a partir del claim `cod_unidad`, y garantizar que todas las queries y mutations de negocio filtren por la unidad del usuario autenticado.

**Prerrequisito de todas las fases siguientes.** No empezar Fase 2 hasta que esta esté `COMPLETADO` (o al menos con el modo fake en DEBUG funcionando).

### Alcance

1. **Modelo `Unidad`** (minimalista):
   - `codigo` (CharField max 20, unique): ej. `"02031"`. Viene del JWT.
   - `nombre` (CharField max 200, blank): opcional, se puede llenar después.
   - `activa` (Boolean, default True).
   - `created_at` (auto_now_add).
   - Sin seeders manuales. Se auto-crea cuando llega un JWT con ese `cod_unidad`.

2. **Campo `unidad` en `User`**:
   - `User.unidad = ForeignKey(Unidad, null=True, blank=True, on_delete=PROTECT)`.
   - Se puebla al autenticar. Si el JWT trae un `cod_unidad` distinto al guardado, actualizar.
   - Guardar también `cod_empleado` (CharField, blank) como metadata del usuario.

3. **Configuración de la clave pública de admincentral:**
   - Variable de entorno `ADMINCENTRAL_JWKS_URL` (si admincentral expone JWKS).
   - O `ADMINCENTRAL_PUBLIC_KEY` (clave estática en PEM, cargada por env var).
   - Variable `ADMINCENTRAL_AUDIENCE` (si el JWT tiene `aud`, ej. `"sistema-archivos"`).
   - **Confirmar con el equipo de admincentral cuál usar.** Mientras tanto, usar modo fake (punto 5).

4. **Middleware `AdminCentralJWTMiddleware`** en `apps/core/middleware.py`:
   - Lee la cookie `admincentral_access_token` (o el header `Authorization: Bearer ...`).
   - Verifica la firma del JWT con la clave pública (RS256).
   - Verifica `exp` (no expirado), `iss == "admincentral"`, y `aud` si está configurado.
   - Extrae claims: `cod_unidad`, `username`, `rol_slug`, `cod_empleado`, `email`, `full_name`.
   - Hace `Unidad.objects.get_or_create(codigo=cod_unidad)`.
   - Hace `User.objects.get_or_create(username=username, defaults={...})` y actualiza `unidad`, `cod_empleado`, `email`, `role` si cambiaron.
   - Adjunta `request.unidad`, `request.user`, `request.jwt_claims` al request.
   - Si falta el JWT o es inválido: responde 401 en endpoints protegidos. Lista blanca: `/health/`, docs.
   - **No guarda el JWT en la BD.** Solo lo lee y verifica en cada request.

5. **Modo fake en DEBUG (para no bloquear el desarrollo):**
   - Variable de entorno `DEV_FAKE_UNIDAD` (solo se usa si `DEBUG=True`).
   - Si `DEBUG=True` y `DEV_FAKE_UNIDAD` está seteada, el middleware **omite la verificación del JWT** y simula los claims:
     claims = {"cod_unidad": settings.DEV_FAKE_UNIDAD, "username": "dev", "rol_slug": "admin-archivos", "cod_empleado": "DEV", "email": "dev@local", "full_name": "Dev User"}
   - Esto permite desarrollar las fases 2-5 sin esperar la clave pública de admincentral.
   - **En producción (`DEBUG=False`) el modo fake se ignora siempre.**

6. **Helper `get_unidad_actual(request)`** en `apps/core/tenancy.py`:
   - Devuelve `request.unidad` o lanza `PermissionDenied` si no existe.
   - Todas las queries de negocio lo usan.

7. **Filtro obligatorio en queries y mutations:**
   - Toda query GraphQL y REST que devuelva datos de negocio debe hacer `.filter(unidad=get_unidad_actual(request))`.
   - Toda mutation que reciba un ID debe verificar que el objeto pertenezca a la unidad del usuario. Si no, responder **404** (no 403, para no filtrar existencia).
   - Revisar **todas** las queries existentes (`personas`, `tiposDocumento`, `documentosPersona`, `documentosPendientes`, colas de revisión, etc.) y agregar el filtro.

8. **Migración de datos existentes:**
   - Crear `Unidad(codigo="LEGACY")` en una migración de datos.
   - Asignar todos los `Persona`, `TipoDocumento`, `Documento` existentes a esa unidad.
   - Asignar todos los `User` existentes a esa unidad.
   - Documentar que `LEGACY` es transitoria.

9. **Frontend:**
   - Configurar Apollo Client con `credentials: "include"` para enviar la cookie automáticamente.
   - Query `me { username, rolSlug, unidad { codigo, nombre } }` para mostrar el perfil del usuario.
   - Si el backend responde 401, redirigir a admincentral (URL por env var `VITE_ADMINCENTRAL_LOGIN_URL`) para que refresque la cookie o vuelva a loguear.
   - No guardar el JWT en `localStorage` ni `sessionStorage`.
   - Configurar CORS en backend con `CORS_ALLOW_CREDENTIALS=True` y `CORS_ALLOWED_ORIGINS` con el dominio del frontend.

10. **Tests:**
   - Un JWT con `cod_unidad="02031"` solo ve documentos de esa unidad.
   - Un JWT con `cod_unidad="02032"` solo ve los de la otra.
   - Un request sin JWT → 401.
   - Un JWT con firma inválida → 401.
   - Un JWT expirado → 401.
   - Un usuario de unidad A intentando acceder a un documento de unidad B → 404.
   - Un usuario de unidad A intentando modificar un documento de unidad B → 404.
   - El modo fake en DEBUG funciona y crea/usa la unidad especificada.
   - Los datos existentes quedan asignados a `Unidad(codigo="LEGACY")`.

### Criterios de aceptación

- [x] Existe `Unidad` con `codigo` unique.
- [x] Existe `User.unidad` y `User.cod_empleado`.
- [x] Existe el middleware que valida el JWT de admincentral y adjunta `request.unidad`.
- [x] Existe el modo fake en DEBUG (`DEV_FAKE_UNIDAD`) y no se activa en producción.
- [x] Los usuarios se auto-crean la primera vez que llegan con un JWT válido.
- [x] Todas las queries y mutations de negocio filtran por `unidad`.
- [x] Tests de aislamiento pasan (unidad A no ve ni modifica datos de unidad B).
- [x] Datos existentes migrados a `Unidad(codigo="LEGACY")`.
- [x] La clave pública de admincentral se carga por env var, no hardcodeada.
- [x] El frontend envía cookies (`credentials: "include"`) y maneja 401 redirigiendo a admincentral.
- [x] CORS configurado con `CORS_ALLOW_CREDENTIALS=True`.

---

## FASE 2 — Modelo de datos: Lote, Página, Documento, Firma y Grupos

**Estado:** `COMPLETADO`

**Prioridad:** 🔴 Crítica

**Objetivo:** Reemplazar el modelo actual (Documento = página individual) por uno que distinga **Lote** (subida), **Página** (unidad física del PDF), **Documento** (conjunto de páginas confirmadas como uno solo) y **Grupo** (agrupamiento provisional de páginas similares). **Todos los modelos heredan `unidad` desde el día 1.**

### Alcance

1. Crear modelos nuevos en `apps/documentos` (o en una app nueva `apps/agrupamiento` si se prefiere):

**Lote**
- `id`, `unidad` (FK), `subido_por` (FK User), `created_at`
- `estado`: `procesando`, `pendiente_nombres`, `confirmado`, `descartado`
- `nombre_archivo_original`
- `total_paginas`, `total_grupos`

**Página** (reemplaza el rol de la antigua `Documento` como unidad física)
- `id`, `unidad` (FK, denormalizada), `lote` (FK)
- `pdf_origen` (nombre del PDF), `nro_pagina_en_pdf` (1-indexado)
- `texto_ocr` (Text)
- `firma_palabras` (JSONField: lista de top-N palabras normalizadas)
- `firma_estructura` (JSONField: `{largo, ratio_numeros, patrones}`)
- `phash` (CharField max 64, null, db_index)
- `descartable` (Boolean, default False)
- `grupo` (FK Grupo, null)
- `estado`: `pendiente`, `agrupada`, `confirmada`, `descartada`, `sin_agrupar`, `duplicada`

**Documento** (unidad lógica: puede ser 1 o más páginas)
- `id`, `unidad` (FK, denormalizada), `lote` (FK), `tipo_documento` (FK, null hasta confirmar)
- `paginas` (M2M a Página, ordenadas por `nro_pagina_en_pdf`)
- `es_doble_cara` (Boolean)
- `estado`: `pendiente`, `confirmado`, `verificado`
- `nombre_final` (CharField, blank)
- `historial_clasificacion` (JSONField)

**Grupo** (provisional, por lote)
- `id`, `unidad` (FK, denormalizada), `lote` (FK)
- `firma_consolidada` (JSONField), `total_paginas`
- `tipo_documento_sugerido` (FK, null)
- `estado`: `nuevo`, `coincide_con_tipo`, `confirmado`, `rechazado`

**TipoDocumento** (se mantiene, con ajustes)
- `id`, `unidad` (FK), `nombre`, `slug`, `color`
- `firma_consolidada` (JSONField)
- `ejemplos_paginas` (M2M a Página, máximo 20)
- `palabras_clave` (Text: "palabra:peso")
- `keywords_obligatorias` (JSONField: lista de strings)
- `unique_together = (slug, unidad)`

2. **Migrar los datos existentes**: cada `Documento` viejo se convierte en un `Lote` de 1 PDF con 1 `Página` y 1 `Documento` de 1 página. Asignar `unidad=LEGACY`. Preservar `tipo_documento_id` y `estado`.
3. Actualizar GraphQL para exponer los nuevos modelos.
4. Actualizar el frontend mínimo para que las listas existentes sigan funcionando.

### Criterios de aceptación

- [x] Las migraciones aplican sin errores y los datos existentes se preservan.
- [x] Todos los modelos nuevos tienen `unidad` FK.
- [x] GraphQL expone `Lote`, `Pagina`, `Documento`, `Grupo`, `TipoDocumento`.
- [x] Un `Documento` puede tener N páginas (M2M).
- [x] El frontend no rompe con los modelos nuevos.
- [x] Todas las queries nuevas filtran por `unidad`.


### Notas

- No agregues lógica de agrupamiento en esta fase. Solo modelos.
- No toques el clasificador todavía (eso es Fase 3).
- Denormalizar `unidad` en `Pagina`, `Documento` y `Grupo` para evitar joins costosos.

---

## FASE 3 — Motor de agrupamiento por firmas (sin IA)

**Estado:** `COMPLETADO`

**Prioridad:** 🟠 Alta

**Objetivo:** Dado un lote de páginas, agruparlas por similitud usando firmas de palabras + estructura + pHash. Sin IA, sin embeddings.

### Alcance

1. Crear `apps/documentos/agrupador.py` con:

- `normalizar(texto: str) -> str`: minúsculas, quitar acentos (NFKD), colapsar espacios, eliminar caracteres no alfanuméricos.

- `extraer_firma(pagina: Pagina) -> Firma`:
- `firma_palabras`: top 20 palabras normalizadas tras quitar stopwords en español.
- `firma_estructura`: `{largo: "corto|medio|largo", ratio_numeros, patrones: ["fecha", "monto_bs", "nit", "ci", ...]}` detectados por regex.
- `phash`: si no existe, calcularlo (ver Fase 6).

- `similitud_palabras(f1, f2) -> float`: Jaccard de top-20.
- `similitud_estructura(f1, f2) -> float`: comparar largo, ratio de números y patrones.
- `similitud_total(f1, f2) -> float`: promedio ponderado (palabras 0.6, estructura 0.3, phash 0.1 si existe).

- `agrupar(paginas: list[Pagina], umbral: float = 0.6) -> list[Grupo]`:
- Clustering aglomerativo simple o greedy. Fusionar grupos cuya similitud entre centros supere el umbral.

- `comparar_con_tipos(grupo: Grupo, tipos: list[TipoDocumento]) -> TipoDocumento | None`:
- Comparar `firma_consolidada` del grupo contra `firma_consolidada` de cada tipo (siempre filtrando por `unidad`).
- Si el mejor match supera 0.7, devolver ese tipo. Si no, `None`.

2. Agregar `rapidfuzz` a `requirements/base.txt`.
3. Tests unitarios:
- Dos páginas de factura distintas → mismo grupo.
- Una factura y un recibo → grupos distintos.
- Una hoja en blanco → `descartable=True`, no se agrupa.
- Grupo de facturas comparado contra tipo "Factura" existente → devuelve el tipo.
- Grupo de recibos comparado contra tipo "Factura" → `None`.
- Páginas de dos unidades distintas → nunca se agrupan juntas.

### Criterios de aceptación

- [x] `agrupador.py` existe y no importa modelos de Django directamente.
- [x] `agrupar()` devuelve grupos coherentes para un lote de prueba de al menos 20 páginas de 3 tipos distintos.
- [x] `comparar_con_tipos()` respeta la unidad.
- [x] Los tests pasan.
- [x] Páginas con `len(texto_normalizado) < 10` se marcan `descartable=True`.


### Notas

- No introduzcas embeddings, ni sklearn, ni nada de ML.
- El umbral 0.6 es configurable.
- Si el lote tiene < 2 páginas, no agrupar; devolver un solo grupo.

---

## FASE 4 — Detección de documentos de doble cara (confirmación del usuario + cercanía)

**Estado:** `COMPLETADO`

**Prioridad:** 🟠 Alta

**Objetivo:** Permitir que el usuario marque dos páginas consecutivas del mismo PDF como un solo documento (anverso/reverso), y que el sistema lo detecte automáticamente cuando sea evidente.

### Alcance

1. En `agrupador.py`, agregar `detectar_parejas_consecutivas(paginas: list[Pagina]) -> list[tuple[Pagina, Pagina]]`:
- Para cada par de páginas consecutivas (`nro_pagina_en_pdf` N y N+1) del mismo `pdf_origen` y misma `unidad`:
- Si `similitud_total(firma_N, firma_N+1) > 0.5` **Y** al menos una tiene < 200 caracteres de texto → probablemente anverso/reverso.
- Devolver el par como sugerencia.

2. **Flujo en la UI:**
- Si dos páginas consecutivas caen en el mismo grupo, se muestran juntas.
- Checkbox ya marcado: "☑ Estas dos páginas son el mismo documento (anverso/reverso)".
- El usuario puede desmarcar.
- El usuario **también puede agregar manualmente** una página a un documento ya formado ("+ Agregar reverso").

3. En el modelo `Documento`:
- `es_doble_cara` se setea a `True` cuando el usuario confirma la pareja.
- `paginas` M2M contiene las 2 (o más) páginas en orden.

4. **Regla de negocio:** un `Documento` no puede tener más de 2 páginas por defecto. Si el usuario quiere agregar una tercera, mostrar advertencia (permite continuar).

### Criterios de aceptación

- [x] `detectar_parejas_consecutivas()` devuelve parejas sugeridas.
- [x] La UI muestra el checkbox ya marcado cuando el sistema sugiere pareja.
- [x] El usuario puede desmarcar y las páginas quedan separadas.
- [x] El usuario puede agregar manualmente una página a un documento existente.
- [x] `Documento` con `es_doble_cara=True` guarda correctamente las 2 páginas.
- [x] Páginas de distintas unidades nunca se emparejan.

### Notas

- No detectes "reverso" por contenido (ej. "esta página dice 'reverso'"). Es frágil.
- El umbral 0.5 y el límite de 200 caracteres son configurables.

---

## FASE 5 — Pantalla de agrupamiento (frontend)

**Estado:** `COMPLETADO`

**Prioridad:** 🟠 Alta

**Objetivo:** Construir la pantalla donde el usuario, después de subir un lote, ve los grupos detectados, les asigna nombre (nuevo tipo) o confirma tipo existente, y confirma documentos de doble cara.

### Alcance

1. Nueva ruta `/lotes/:loteId/agrupar`.
2. Layout:
- Encabezado: "Lote procesado: N páginas. El sistema encontró M grupos."
- Lista de tarjetas (una por grupo):
- Miniaturas (2-3 páginas de muestra).
- Texto de ejemplo (primeros 200 caracteres de la primera página del grupo).
- Total de páginas del grupo.
- Si `tipo_documento_sugerido`: "✅ Se parece a: [nombre] ¿Confirmas?" con [Sí] [No, es otro tipo].
- Si no: "⚠️ No coincide con ningún tipo existente. Nombre: [input]" con [Crear tipo].
- Si el grupo contiene páginas consecutivas: checkbox "☑ Estas dos páginas son el mismo documento" ya marcado.
- Botón "Ver todas las páginas del grupo" (modal).
3. Al pie: botón "Confirmar agrupamiento" (deshabilitado hasta que todos los grupos tengan nombre o confirmación).
4. Al confirmar:
- Crear `TipoDocumento` para los grupos nuevos (`unidad=request.unidad`, `firma_consolidada` calculada).
- Actualizar `firma_consolidada` de los tipos existentes.
- Crear `Documento` por cada grupo (`unidad=request.unidad`).
- Marcar `Lote.estado='confirmado'`.
- Redirigir a `/lotes/:loteId`.
5. Mutation GraphQL `confirmarAgrupamiento(loteId: ID!, asignaciones: [AsignacionGrupoInput!]!): Lote!` en una transacción.

### Criterios de aceptación

- [x] La ruta existe y muestra los grupos del lote.
- [x] El usuario puede crear tipos nuevos y confirmar tipos existentes.
- [x] El checkbox de doble cara funciona.
- [x] Al confirmar, los `Documento` se crean con sus páginas y `unidad`.
- [x] Los tipos nuevos aparecen con su `firma_consolidada` poblada.
- [x] La pantalla es usable con 10, 50 y 200 grupos.
- [x] Un usuario no puede confirmar grupos de un lote de otra unidad (404).

### Notas

- No construir dashboard con métricas.
- Si el lote tiene > 50 grupos, mostrar de 10 en 10 con paginación.
- No toques el agrupador ni el detector de parejas. Solo consume sus resultados.
- Si no hay tipos existentes, todos los grupos piden nombre (primera subida).

---

## FASE 6 — Deduplicación por pHash

**Estado:** `COMPLETADO`

**Prioridad:** 🟡 Media

**Objetivo:** Detectar páginas duplicadas dentro de la misma unidad para no contarlas dos veces.

### Alcance

1. Agregar dependencias: `Pillow`, `imagehash` a `requirements/base.txt`.
2. En `pdf_processor.py`, al iterar páginas, generar thumbnail PNG de cada página con `fitz` (150 DPI) y subirla a MinIO en `unidades/{codigo}/thumbs/{uuid}.png`.
3. Calcular `pHash` del thumbnail y guardarlo en `Pagina.phash`.
4. En el agrupador, antes de agrupar, comparar `phash` de cada página contra las páginas ya confirmadas de la misma unidad. Si distancia Hamming ≤ 5, marcar `estado='duplicada'` y no agruparla.
5. GraphQL: query `paginasDuplicadas(limit: Int, offset: Int): [Pagina!]!` (filtra por unidad del request).
6. Frontend: badge "Duplicada" en las listas de páginas.

### Criterios de aceptación

- [x] Cada `Pagina` nueva tiene `phash` calculado.
- [x] Una página duplicada se marca como tal y no entra al agrupamiento.
- [x] Los thumbnails se almacenan en MinIO bajo `unidades/{codigo}/thumbs/`.
- [x] Solo se comparan páginas de la misma unidad.

### Notas

- Esta fase **duplica almacenamiento**. Documentar el costo.
- Si el volumen actual es bajo (< 1000 docs), considerar posponerla.
- No re-procesar páginas históricas en esta fase. Solo aplicar a nuevas.

---

## FASE 7 — Cola residual: páginas que no se pudieron agrupar

**Estado:** `COMPLETADO`

**Prioridad:** 🟡 Media

**Objetivo:** Dar salida a las páginas que el agrupador no pudo procesar (OCR basura, escaneos malos, texto muy escaso pero no descartable).

### Alcance

1. Query GraphQL `paginasSinAgrupar(limit: Int, offset: Int): [Pagina!]!` que devuelve páginas con `estado='sin_agrupar'` de la unidad del request.
2. Frontend: ruta `/revision/sin-agrupar`.
   - Cada tarjeta: miniatura, `texto_ocr`, fecha de subida, lote al que pertenece.
   - Acciones: [Asignar a tipo existente ▼] [Crear tipo nuevo] [Descartar página].
   - Botón "Confirmar" por tarjeta.
3. Mutations:
   - `asignarPaginaATipo(paginaId: ID!, tipoDocumentoId: ID!)`: valida que ambos sean de la unidad del request. Crea `Documento` de 1 página, marca página `confirmada`.
   - `crearTipoYAsignar(paginaId: ID!, nombre: String!)`: crea tipo en la unidad del request y asigna.
   - `descartarPagina(paginaId: ID!)`: marca `descartada`.
4. Guardas de ruta: solo `admin` y `operador`.

### Criterios de aceptación

- [x] Las páginas sin agrupar aparecen en la cola.
- [x] Las 3 acciones funcionan y persisten.
- [x] Las páginas descartadas no vuelven a aparecer.
- [x] Las rutas están protegidas por rol.
- [x] Un usuario no puede actuar sobre páginas de otra unidad (404).

### Notas

- Las hojas en blanco (`descartable=True`) **no** deben aparecer aquí.
- No construir dashboard con métricas.
- Si no hay sistema de sesión funcional en el frontend, documenta el bloqueo y deja las guardas como TODO.

---

## FASE 8 — Eliminación de Google Drive y del clasificador IA

**Estado:** `COMPLETADO`

**Prioridad:** 🟠 Alta

**Objetivo:** Quitar del código todo lo relacionado con Google Drive y con la IA generativa.

### Alcance

1. Eliminar `apps/storage/providers/google_drive.py` y sus importaciones.
2. Eliminar `apps/storage/ai_classifier.py`.
3. Eliminar comandos `sincronizar_origenes` y `sincronizar_periodico`.
4. Eliminar modelos `OrigenArchivos` y `Sincronizacion`.
5. Eliminar dependencias `google-genai`, `google-api-python-client`, `google-auth`.
6. Eliminar variables de entorno `GOOGLE_*`, `GEMINI_*`.
7. Ajustar `/api/upload/batch/` como única entrada de archivos.
8. Correr `grep` para asegurar que no queden referencias.

### Criterios de aceptación

- [x] No queda código que importe `google`, `gemini` o `genai`.
- [x] No quedan modelos `OrigenArchivos` ni `Sincronizacion` en uso.
- [x] No quedan comandos de sincronización con Drive.
- [x] El endpoint de upload funciona.
- [x] El sistema arranca sin errores de importación.

---

## FASE 9 — Aprendizaje incremental de firmas

**Estado:** `COMPLETADO`

**Prioridad:** 🟢 Baja

**Objetivo:** Cada vez que el usuario confirma un documento, actualizar la `firma_consolidada` del tipo correspondiente para que la próxima subida agrupe mejor.

### Alcance

1. Al confirmar un `Documento` (Fase 5 o Fase 7), recalcular `firma_consolidada` del `TipoDocumento`:
   - Promedio de las `firma_palabras` de sus `ejemplos_paginas` (top 20 palabras por frecuencia agregada).
   - Promedio de `firma_estructura`.
   - Actualizar `ejemplos_paginas` (máximo 20, FIFO).
2. Cálculo en la **misma transacción** de confirmación.
3. Tests unitarios: confirmar 5 documentos del mismo tipo y verificar coherencia.

### Criterios de aceptación

- [x] Al confirmar un documento, la firma del tipo se actualiza.
- [x] Con 5 documentos confirmados del mismo tipo, la firma consolidada es coherente.
- [x] El cálculo no bloquea la UI (< 200ms para lotes de < 100 páginas).

### Notas

- No usar IA ni embeddings. Conteo y promedios.
- Si la transacción se vuelve lenta, mover a job asíncrono (no ahora).

---

## FASE 10 — Sugerencias al admin (sin jerga técnica)

**Estado:** `COMPLETADO`

**Prioridad:** 🟢 Baja

**Objetivo:** Cuando el admin edita un tipo, mostrarle sugerencias en lenguaje natural derivadas de las firmas consolidadas, sin pesos ni ratios ni obligatoriedad técnica.

### Alcance

1. Al abrir `/tipos-documento/:id`, calcular:
   - Palabras en > 80% de `ejemplos_paginas` → "Siempre aparecen en este tipo".
   - Palabras en 30-80% → "Suelen aparecer".
   - Palabras que estaban antes y ya no aparecen → "Ya no aparecen. ¿Quitar?".
2. Mostrar como:
   - Lista con checkboxes (no pesos).
   - Checkbox de candado (🔒) para "Sin esta palabra no es [tipo]".
3. Al guardar, traducir a `palabras_clave` (formato `palabra:peso`) y `keywords_obligatorias` internamente. El admin nunca ve números.

### Criterios de aceptación

- [x] La pantalla muestra las 3 listas (siempre / suelen / ya no aparecen).
- [x] El admin puede marcar/desmarcar palabras y candados.
- [x] Al guardar, `palabras_clave` y `keywords_obligatorias` se actualizan correctamente.
- [x] El admin no ve ningún número de peso ni ratio.
- [x] Solo se muestran tipos de la unidad del admin.

### Notas

- No construir dashboard con métricas.
- No introducir conceptos de "TF-IDF" ni "frecuencia relativa" en la UI.
- Si hay menos de 3 `ejemplos_paginas`, mostrar "Aún no hay suficientes documentos para sugerir palabras".

---

## Resumen de fases

| Fase | Nombre | Prioridad | Estado |
|------|--------|-----------|--------|
| 1 | Autenticación vía JWT de admincentral + aislamiento por unidad | 🔴 Crítica | `COMPLETADO` |
| 2 | Modelo de datos: Lote, Página, Documento, Firma y Grupos | 🔴 Crítica | `COMPLETADO` |
| 3 | Motor de agrupamiento por firmas (sin IA) | 🟠 Alta | `COMPLETADO` |
| 4 | Detección de documentos de doble cara | 🟠 Alta | `COMPLETADO` |
| 5 | Pantalla de agrupamiento (frontend) | 🟠 Alta | `COMPLETADO` |
| 6 | Deduplicación por pHash | 🟡 Media | `COMPLETADO` |
| 7 | Cola residual: páginas sin agrupar | 🟡 Media | `COMPLETADO` |
| 8 | Eliminación de Google Drive y del clasificador IA | 🟠 Alta | `COMPLETADO` |
| 9 | Aprendizaje incremental de firmas | 🟢 Baja | `COMPLETADO` |
| 10 | Sugerencias al admin (sin jerga técnica) | 🟢 Baja | `COMPLETADO` |

**Orden de ejecución recomendado:** 8 (ya está) → 1 (ya está) → 2 → 3 → 4 → 5 → 9 → 6 → 7 → 10
