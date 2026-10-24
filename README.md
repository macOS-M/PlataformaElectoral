# Plataforma de Gestión Política y Electoral Cantonal

> **Estado:** En planificación / desarrollo inicial · **Versión del alcance:** 0.1 · **Ámbito inicial:** un cantón de Costa Rica

Aplicación web para **centralizar la estructura organizativa, la coordinación territorial y la gestión logística electoral** de una organización política a escala cantonal. El objetivo es sustituir registros dispersos y procesos en papel por información consistente, responsables identificados, seguimiento de pendientes y alertas operativas.

El alcance piloto contempla **aproximadamente 70 escuelas o centros de votación**, vinculados con distritos, juntas receptoras de votos (JRV), responsables y necesidades logísticas. La plataforma se diseñará para ampliar posteriormente su cobertura a otros cantones sin duplicar la aplicación.

> **Nota:** Este repositorio describe un producto en construcción. Los módulos y características que aparecen a continuación son **requisitos y objetivos**, no funcionalidades ya implementadas. La plataforma es una herramienta de coordinación interna; **no es un sistema oficial del Tribunal Supremo de Elecciones (TSE)** y no sustituye sus procedimientos, acreditaciones, resultados ni competencias.

## Contenido

- [Objetivos](#objetivos)
- [Alcance de la primera versión](#alcance-de-la-primera-versión)
- [Estructura organizacional](#estructura-organizacional)
- [Gestión de centros de votación](#gestión-de-centros-de-votación)
- [Áreas funcionales](#áreas-funcionales)
- [Módulo Día E](#módulo-día-e)
- [Requisitos](#requisitos)
- [Tecnologías propuestas](#tecnologías-propuestas)
- [Arquitectura y datos](#arquitectura-y-datos)
- [Plan de desarrollo](#plan-de-desarrollo)
- [Instalación y ejecución](#instalación-y-ejecución)
- [Seguridad y consideraciones](#seguridad-y-consideraciones)
- [Glosario](#glosario)

## Objetivos

- Centralizar la información de la estructura cantonal, los distritos y los centros de votación.
- Definir cargos, suplencias, responsables y enlaces sin duplicar innecesariamente puestos por distrito.
- Registrar necesidades, inventarios, asignaciones y tareas de las áreas operativas.
- Preparar la jornada electoral y coordinar incidencias desde **Día E**.
- Visualizar avances, faltantes, pendientes e indicadores mediante tableros.
- Introducir recomendaciones basadas en reglas verificables, con aprobación humana.

## Alcance de la primera versión

| Elemento | Alcance inicial |
| --- | --- |
| Territorio | **1 cantón** y sus distritos |
| Centros | **≈70 escuelas/centros de votación** |
| Organización | Coordinación General Cantonal, coordinadores distritales y responsables funcionales |
| Áreas | **9 áreas funcionales** |
| Día E | Preparación y seguimiento básico de jornada, con incidencias y tareas |
| Datos | Carga manual y, según avance, importación CSV/Excel |
| Escalamiento | Más cantones y organizaciones en fases posteriores |

### Prioridades del demo

1. Directorio de personas, cargos y asignaciones.
2. Organigrama cantonal y coordinaciones distritales.
3. Catálogo y ficha editable de centros de votación.
4. Nueve áreas funcionales visibles, con una primera gestión de responsables y pendientes.
5. Tablero cantonal con indicadores básicos.
6. **Día E**: lista de preparación, registro de incidencias y seguimiento de estado por centro.

**Fuera de alcance del demo inicial:** monitoreo automatizado de redes sociales, optimización avanzada de rutas, integraciones oficiales con TSE, procesamiento masivo de padrón, gestión financiera completa, multicliente avanzado y operación electoral certificada.

## Estructura organizacional

```text
Coordinador General Cantonal
├── Coordinadores distritales (uno por distrito)
│   └── Enlaces territoriales y operativos (según necesidad)
└── Responsables de las 9 áreas funcionales
    ├── Signos externos
    ├── Movimientos sectoriales
    ├── Territoriales
    ├── Electorales
    ├── Transporte
    ├── Alimentación
    ├── Coordinación Día E
    ├── Redes sociales
    └── Enlace TSE
```

Los responsables de las áreas trabajan a nivel cantonal y pueden contar con enlaces en distritos específicos. **No es obligatorio replicar los nueve cargos en cada distrito**. Una persona puede ocupar más de un cargo cuando corresponda, sin duplicar su ficha.

Los movimientos sectoriales inicialmente previstos son **Mujeres, Juventud, Empresarial, Agropecuario, Adultos Mayores e Inclusión**. Deben mantenerse configurables.

### Gestión del organigrama

- Registrar y editar personas y medios de contacto.
- Crear y consultar cargos, responsabilidades y suplencias.
- Asignar personas a cargos cantonales o distritales.
- Consultar vacantes y filtrar el directorio por nombre, cargo o distrito.
- Visualizar el organigrama y exportar un directorio básico.

## Gestión de centros de votación

Cada centro debe contar con una **ficha única** para relacionar información territorial, electoral y operativa.

| Grupo | Datos contemplados |
| --- | --- |
| Identificación | Nombre, código TSE, distrito, dirección y ubicación geográfica |
| Contactos | Dirección del centro, teléfonos y contactos institucionales cuando corresponda |
| JRV | Cantidad de juntas y espacios/aulas asignados, sujeto a información oficial disponible |
| Estado | Confirmación o ratificación del centro según fuente oficial |
| Personal | Responsables operativos y enlaces asociados |
| Recursos | Necesidades y asignaciones de materiales, transporte y alimentación |
| Seguimiento | Tareas, incidencias, observaciones y estado de preparación |

Funciones iniciales: **crear, consultar, editar, listar, buscar y filtrar** centros. Posteriormente: importación masiva, inventarios detallados, documentos, mapas y reportes especializados.

> Una escuela no es equivalente a una JRV: un centro puede contener **varias juntas**. El sistema debe modelarlas por separado. Los datos oficiales del TSE prevalecen sobre los registros internos.

## Áreas funcionales

| # | Área | Información operativa prevista |
| --- | --- | --- |
| 01 | **Signos externos** | Banderas, camisetas, distintivos, existencias, entregas y devoluciones |
| 02 | **Movimientos sectoriales** | Movimientos, coordinadores, actividades y tareas |
| 03 | **Territoriales** | Distritos, barrios, comunidades y enlaces locales |
| 04 | **Electorales** | Centros, JRV, fiscales, cobertura y seguimiento de acreditaciones |
| 05 | **Transporte** | Vehículos, conductores, rutas, horarios, asignaciones y documentación |
| 06 | **Alimentación** | Suministros, proveedores, cantidades y entregas |
| 07 | **Coordinación Día E** | Preparación, operación, incidencias y cierre de jornada |
| 08 | **Redes sociales** | Calendario de publicaciones, contenido y canales propios |
| 09 | **Enlace TSE** | Trámites, consultas, comunicaciones, normativa y vencimientos |

Los módulos compartirán catálogos de **personas, centros, territorios, tareas y documentos**; no se deben crear bases de datos aisladas por área.

## Módulo Día E

**Día E** será una sección destacada de la aplicación y un **centro de operaciones transversal** a las nueve áreas, con coordinación propia para la jornada electoral.

### Antes de la jornada

- Confirmar coordinador Día E, responsables distritales y suplencias.
- Verificar listado de centros y JRV, documentación y cobertura de fiscales.
- Revisar vehículos, materiales, alimentación y canales de comunicación.
- Completar una lista de verificación preelectoral y un cronograma operativo.

### Durante la jornada

- Recibir reportes operativos por distrito y centro.
- Registrar incidencias con hora, descripción, categoría, prioridad y persona responsable.
- Asignar incidencias a un área, dar seguimiento y documentar acciones.
- Visualizar reportes de apertura, operación y cierre **como información interna**, no como certificación oficial.

### Después de la jornada

- Cerrar incidencias, registrar devoluciones y pendientes.
- Consolidar reportes e información de la operación para el informe final.

**Estados sugeridos de incidencia:** `reportada → asignada → en_atencion → resuelta → cerrada`. Se preservará un historial de actualizaciones.

## Requisitos

Los identificadores son **convenciones internas del proyecto**; no códigos del TSE.

### Requisitos funcionales representativos

| ID | Requisito | Prioridad |
| --- | --- | --- |
| RF-ORG-01 | Mostrar el organigrama cantonal | Alta |
| RF-ORG-02 | Crear y editar personas y contactos | Alta |
| RF-ORG-03 | Asignar personas a cargos y ámbitos territoriales | Alta |
| RF-ORG-04 | Gestionar coordinaciones distritales y vacantes | Alta |
| RF-ORG-05 | Administrar nueve áreas y movimientos sectoriales | Alta |
| RF-CEN-01 | Registrar centros de votación | Alta |
| RF-CEN-02 | Consultar y editar fichas de centros | Alta |
| RF-CEN-03 | Asociar centros a distritos y JRV | Alta |
| RF-CEN-04 | Buscar y filtrar centros | Alta |
| RF-CEN-05 | Vincular responsables, recursos y tareas a centros | Alta |
| RF-DIE-01 | Gestionar checklist y cronograma de Día E | Alta |
| RF-DIE-02 | Registrar y asignar incidencias | Alta |
| RF-DIE-03 | Consultar estados y reportes por centro | Alta |
| RF-DIE-04 | Generar resumen operativo e historial | Media |
| RF-IMP-01 | Importar centros mediante CSV/Excel | Media |
| RF-REP-01 | Mostrar indicadores y alertas operativas | Media |

### Requisitos no funcionales iniciales

- **RNF-01 — Seguridad:** autenticación y controles básicos de autorización; credenciales fuera del repositorio.
- **RNF-02 — Privacidad:** minimización de datos, accesos restringidos, tratamiento adecuado de información personal y retención definida.
- **RNF-03 — Integridad:** validación de entradas, restricciones relacionales y prevención de duplicados.
- **RNF-04 — Auditoría:** identificar autor, fecha y operación de cambios relevantes cuando se usen datos reales.
- **RNF-05 — Usabilidad:** interfaz responsiva, usable en escritorio y móvil.
- **RNF-06 — Rendimiento:** consultas paginadas, índices y tiempos de respuesta adecuados para ≈70 centros.
- **RNF-07 — Respaldo:** copias de seguridad y procedimiento de restauración antes de un piloto real.
- **RNF-08 — Mantenibilidad:** módulos desacoplados, tipado estricto, pruebas y migraciones versionadas.
- **RNF-09 — Disponibilidad:** monitoreo de errores y plan de contingencia antes de operar en una jornada real.
- **RNF-10 — Trazabilidad:** cada incidencia y asignación debe conservar su estado y responsable.

### Criterios de aceptación del primer módulo

- Se puede crear, editar y consultar una persona sin duplicar su registro por ocupar varios cargos.
- Se puede asignar un responsable cantonal y un coordinador por distrito.
- El organigrama muestra cargos ocupados y vacantes.
- Se pueden registrar y buscar centros del cantón con su distrito correspondiente.
- Las JRV están asociadas a un centro, no directamente al cantón.
- Día E permite registrar una incidencia y seguir su estado hasta el cierre.
- El dashboard refleja los cambios persistidos en la base de datos.

## Tecnologías propuestas

| Componente | Tecnología |
| --- | --- |
| Aplicación web | **Next.js + React + TypeScript** |
| Interfaz | **Tailwind CSS + shadcn/ui** |
| Persistencia | **PostgreSQL** administrado en **Supabase** |
| Autenticación | **Supabase Auth** |
| Acceso a datos | **Drizzle ORM** (propuesto) |
| Tablas | **TanStack Table** |
| Indicadores | **Recharts** |
| Mapas | **Leaflet + OpenStreetMap** (cuando se requiera) |
| Pruebas | **Vitest + Playwright** |
| Despliegue demo | **Vercel** (sujeto a condiciones del plan elegido) |

Se prioriza un **monolito modular**, sin microservicios ni infraestructura de IA innecesaria. Los indicadores y recomendaciones iniciales utilizarán reglas de negocio verificables.

## Arquitectura y datos

```text
Navegador
   │
   ▼
Next.js (interfaz + capa de servidor)
   ├── Organización y directorio
   ├── Territorios y centros/JRV
   ├── Nueve áreas funcionales
   ├── Día E e incidencias
   └── Indicadores y reglas de negocio
   │
   ▼
Supabase / PostgreSQL
   ├── Datos operativos
   ├── Autenticación
   └── Archivos (en fases que lo requieran)
```

**Entidades de referencia:** `people`, `positions`, `assignments`, `districts`, `communities`, `functional_areas`, `sectoral_movements`, `voting_centers`, `voting_boards`, `tasks`, `resources`, `resource_allocations`, `election_events`, `incidents`, `incident_updates`, `documents` y `audit_logs`.

Aunque se inicia con un solo cantón, se recomienda mantener referencias al cantón y al evento electoral en los registros pertinentes, evitando datos rígidos que dificulten ampliaciones futuras.

## Plan de desarrollo

| Sprint | Objetivo | Entregables principales |
| --- | --- | --- |
| **1. Fundamentos** | Estructura inicial | Proyecto, navegación, catálogo de distritos, listado de centros y datos de demostración |
| **2. Organización** | Responsables y cargos | CRUD de personas, posiciones, asignaciones, organigrama y vacantes |
| **3. Centros** | Gestión territorial | Fichas de centros, relaciones con distritos/JRV, búsqueda y edición |
| **4. Operación básica** | Áreas y tareas | Responsables de las nueve áreas, recursos esenciales y pendientes |
| **5. Día E** | Seguimiento | Checklist, registro de incidencias, estados y panel operativo |
| **6. Cierre demo** | Presentación | Pruebas, correcciones, despliegue y guion de demostración |

Los sprints indican **secuencia de trabajo**, no duraciones ni funcionalidades terminadas. La planificación detallada y estimación se validarán contra los requisitos definitivos.

### Definición de terminado (DoD)

Una funcionalidad se considera terminada cuando:

1. Cumple los criterios de aceptación correspondientes.
2. Registra, consulta y modifica los datos correctamente, si aplica.
3. Valida entradas y maneja errores esperables.
4. Respeta las restricciones de acceso establecidas para su fase.
5. Cuenta con pruebas acordes a su criticidad.
6. Es utilizable en móvil y escritorio para los flujos contemplados.
7. Su configuración y uso quedan documentados.

## Instalación y ejecución

**Pendiente de implementar.** Cuando se inicialice el repositorio con el código, se documentarán aquí los requisitos de Node.js, instalación de dependencias, variables de entorno, migraciones y comandos reales de desarrollo/pruebas.

No se incluyen comandos de inicio provisionales para evitar documentar scripts que todavía no existen.

**Variables previstas (nombres sujetos a implementación):** URL de Supabase, clave pública para el cliente y cadena de conexión a PostgreSQL únicamente del lado del servidor. **Nunca publicar claves privadas, tokens o credenciales reales.**

## Seguridad y consideraciones

- La aplicación debe distinguir **fiscales partidarios**, **miembros de JRV** y **personal de apoyo**: no son funciones equivalentes.
- Los registros internos no sustituyen acreditaciones, comunicaciones ni resultados oficiales del **TSE**.
- La información territorial y los datos de contacto deben tratarse de acuerdo con la legislación aplicable, incluida la **Ley 8968** cuando corresponda.
- No se debe inferir la preferencia política de personas a partir del padrón ni almacenar datos sensibles sin base jurídica y controles adecuados.
- Las alertas son apoyo operativo; las decisiones relevantes corresponden a personas responsables.
- Las actividades de comunicación, propaganda, financiamiento y logística deben cumplir las disposiciones vigentes del proceso electoral pertinente.
- Antes de utilizar datos reales en una jornada electoral serán indispensables pruebas de carga, respaldo, seguridad, disponibilidad y planes de contingencia.

## Glosario

| Sigla | Significado |
| --- | --- |
| **TSE** | Tribunal Supremo de Elecciones |
| **JRV** | Junta Receptora de Votos |
| **Día E** | Módulo de preparación, ejecución y cierre de la jornada electoral |
| **RF** | Requisito funcional |
| **RNF** | Requisito no funcional |
| **RF-ORG** | Requisito funcional de organización cantonal |
| **RF-CEN** | Requisito funcional de centros de votación |
| **RF-DIE** | Requisito funcional del módulo Día E |
| **MVP** | Producto mínimo viable |

---

**Estado del proyecto:** planificación y validación funcional. Este README deberá actualizarse junto con los cambios de alcance y la implementación real.
