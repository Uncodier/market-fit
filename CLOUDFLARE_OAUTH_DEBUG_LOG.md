# Cloudflare OAuth Debug Log

Este archivo documenta los diferentes intentos para dar con la cadena exacta de `scope` que Cloudflare requiere para OAuth 2.0.
Cloudflare falla silenciosamente (hace un redirect de regreso a la app con error o asume "0 permissions") si los scopes no coinciden **exactamente** con sus IDs internos o su formato.

## Reglas documentadas por Cloudflare:
1. No acepta delimitadores con dos puntos (`:`).
2. Tienen que ser delimitados por puntos (`.`).
3. El request de OAuth solo validará los scopes solicitados contra lo que se configuró en el dashboard.
4. Requiere `prompt=consent` para forzar la pantalla de permisos si el usuario ya los había aprobado previamente de forma parcial.

---

## Bitácora de Intentos

### Intento 1: Sin enviar parámetro scope
- **Configuración**: `url.searchParams.delete('scope')`
- **Resultado**: Muestra pantalla de consentimiento, pero dice "0 total permissions". Falla al generar el token.
- **Conclusión**: Cloudflare NO toma los permisos "por defecto" de la app si se omite el parámetro, asume que no pides nada.

### Intento 2: Scopes con dos puntos (formato antiguo/interno)
- **Configuración**: `url.searchParams.set('scope', 'zone:read dns_records:read dns_records:edit')`
- **Resultado**: Rebota automáticamente de regreso al callback sin mostrar la pantalla de consentimiento.
- **Conclusión**: El formato con `:` es inválido en OAuth (como dice su doc) y crashea el flujo silenciosamente.

### Intento 3: Solo offline_access
- **Configuración**: `url.searchParams.set('scope', 'offline_access')`
- **Resultado**: Rebota automáticamente o muestra 0 permisos.
- **Conclusión**: Necesitamos solicitar explícitamente los permisos de recursos (DNS/Zone), no solo el permiso de protocolo OAuth.

### Intento 4: Scopes con puntos (dns_records) -> **[PRUEBA ACTUAL]**
- **Configuración**: `url.searchParams.set('scope', 'zone.read dns_records.read dns_records.edit offline_access')`
- **Hipótesis**: Los nombres internos de los permisos en el Token listan "DNS" y "Zone". La versión OAuth usa puntos.
- **Resultado**: *Pendiente de prueba...*

---

## Siguientes combinaciones si el Intento 4 falla:

- **Intento 5**: `zone.read dns.read dns.write offline_access` (algunas documentaciones de integraciones de CF mencionan `dns.read` en lugar de `dns_records.read`).
- **Intento 6**: `zone.read dns.read dns.edit offline_access`
- **Intento 7**: Consultar el endpoint de Cloudflare `GET /client/v4/oauth/scopes` directamente para obtener la lista maestra.