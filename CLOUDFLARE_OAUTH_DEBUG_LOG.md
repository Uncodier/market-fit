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

### Intento 4: Scopes con puntos (dns_records)
- **Configuración**: `url.searchParams.set('scope', 'zone.read dns_records.read dns_records.edit offline_access')`
- **Hipótesis**: Los nombres internos de los permisos en el Token listan "DNS" y "Zone". La versión OAuth usa puntos.
- **Resultado**: Rebote automático.
- **Conclusión**: Falla silenciosamente. No es `dns_records`.

### Intento 5: `dns` en lugar de `dns_records`, `.write` en vez de `.edit`
- **Configuración**: `url.searchParams.set('scope', 'zone.read dns.read dns.write offline_access')`
- **Hipótesis**: En algunas integraciones los permisos cambian a sufijo `.write` o prefijos simplificados.
- **Resultado**: Rebote automático.

### Intento 6: Scopes configurados por el usuario, sin `offline_access`
- **Configuración**: `url.searchParams.set('scope', 'zone:read dns_records:read dns_records:edit')`
- **Hipótesis**: A pesar de que la documentación nueva dice que son delimitados por puntos, a veces el portal y los tokens siguen esperando dos puntos. Si no agregamos `offline_access` explícitamente (ya que Cloudflare dice que lo agrega automáticamente según el `grant_type`), puede que evitemos el error.
- **Resultado**: Rebote automático.

### Intento 7: Omitir parámetro `scope` y probar formato en el Dashboard
- **Configuración**: `url.searchParams.delete('scope')`
- **Hipótesis**: Si el OAuth de Cloudflare está configurado estrictamente según los scopes asignados en su dashboard, es posible que no debamos enviar *ningún* parámetro `scope` en absoluto en la URL `/authorize`. Cloudflare podría auto-asignar los permisos seleccionados en la app (DNS Read, DNS Edit, Zone Read).
- **Resultado**: Muestra la pantalla, pero con "0 total permissions".

### Intento 8: Scopes dot-delimited simplificados `dns.write` -> **[PRUEBA ACTUAL]**
- **Configuración**: `url.searchParams.set('scope', 'zone.read dns.write dns.read')`
- **Hipótesis**: Varios repositorios de código abierto integrando Cloudflare OAuth y documentación moderna indican que los permisos para zona y dns en OAuth ahora se nombran como `zone.read`, `dns.read`, y `dns.write`. (No `dns_records.edit` o con dos puntos).
- **Resultado**: *Pendiente...*