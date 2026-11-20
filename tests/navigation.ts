import { expect, type Page } from '@playwright/test';

export async function context(page: Page, name: string) {
  await page.getByRole('button', { name: `Abrir ${name}`, exact: true }).click();
}
export async function styles(page: Page, tab: string) {
  const panel = page.getByRole('complementary', { name: 'Panel de estilos' });
  if (!(await panel.isVisible()))
    await page.getByRole('button', { name: 'Abrir panel de estilos', exact: true }).click();
  await panel.getByRole('tab', { name: tab, exact: true }).click();
  return panel;
}
export async function catalog(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Catálogo de simetrías' });
  if (!(await dialog.isVisible())) {
    await context(page, 'Simetrías');
    await page.getByRole('tab', { name: 'Grupo y red', exact: true }).click();
    await page.getByRole('button', { name: 'Explorar todas las simetrías · 27' }).click();
  }
  return dialog;
}
export async function symmetry(page: Page, name: string) {
  const dialog = await catalog(page);
  await dialog
    .getByLabel('Sistema', { exact: true })
    .selectOption(
      name.startsWith('Friso')
        ? 'frieze'
        : /[CD]n$/.test(name)
          ? 'radial'
          : name === 'Simetría Libre'
            ? 'none'
            : 'wallpaper',
    );
  await dialog.getByRole('button', { name, exact: true }).click();
  await dialog.getByRole('button', { name: 'Cerrar catálogo', exact: true }).click();
}

/** Follow the visible navigation used by a person; keep original test assertions. */
export async function field(page: Page, label: string) {
  const rightPages: Record<string, string> = {
    Colores: 'Colores',
    'HEX de trazo': 'Colores',
    'Color de trazo': 'Colores',
    'HEX de relleno': 'Colores',
    'Color de relleno': 'Colores',
    'Opacidad de relleno': 'Colores',
    'Grosor de trazo': 'Trazo',
    'Grosor de trazo deslizador': 'Trazo',
    'Opacidad de trazo': 'Trazo',
    'Extremos del trazo': 'Trazo',
    'Uniones del trazo': 'Trazo',
    'Límite de inglete': 'Trazo',
    'Estilo de línea': 'Trazo',
    'Secuencia de guiones': 'Trazo',
    'Fase de guiones (mm)': 'Trazo',
    'Perfil de grosor': 'Perfil',
    'Regla de relleno': 'Fill',
    'Tolerancia de cierre de Fill': 'Fill',
    'Nuevos rellenos vinculados a sus límites': 'Fill',
    'Nombre del preset de estilo': 'Presets',
    'Preset de estilo': 'Presets',
    'Aplicar color de paleta a': 'Paleta',
    'Edición de selección actualiza estilo vigente': 'Opciones',
  };
  if (rightPages[label]) await styles(page, rightPages[label]);
  const properties: Record<string, string> = {
    Ancho: 'Forma',
    Alto: 'Forma',
    Lados: 'Forma',
    Redondez: 'Forma',
    Rotación: 'Forma',
    'Nombre del objeto': 'Forma',
    'Posición X': 'Transformar',
    'Posición Y': 'Transformar',
    Escala: 'Transformar',
    'Nodo activo': 'Nodos',
  };
  if (properties[label]) {
    const panel = await styles(page, 'Objeto');
    await panel.getByRole('tab', { name: properties[label], exact: true }).click();
  }
  if (['Familia', 'Espaciado', 'Distribución', 'Semilla'].includes(label)) {
    await context(page, 'Simetrías');
    await page.getByRole('tab', { name: 'Generador', exact: true }).click();
    for (let i = 0; i < 4 && !(await page.getByLabel(label, { exact: true }).isVisible()); i++) {
      const next = page.getByRole('button', { name: 'Más parámetros', exact: true });
      if (!(await next.isEnabled())) break;
      await next.click();
    }
  }
  if (/tesela|borde|Entrante|Saliente/.test(label)) {
    await context(page, 'Teselas');
    const tab = /Entrante|Saliente/.test(label)
      ? 'Tangentes'
      : /[Bb]orde/.test(label)
        ? 'Bordes'
        : /Origen|Orientación|Contornos/.test(label)
          ? 'Colocación'
          : 'Forma';
    const left = page.getByRole('complementary', { name: 'Panel contextual' });
    if (await left.getByRole('tab', { name: tab, exact: true }).isVisible())
      await left.getByRole('tab', { name: tab, exact: true }).click();
  }
  if (
    [
      'Editar simetría de',
      'Simetría del conjunto',
      'Orientación de red',
      'Origen X',
      'Origen Y',
      'Sectores',
      'Ancho de celda',
      'Alto de celda',
      'Ángulo de red',
    ].includes(label)
  ) {
    await context(page, 'Simetrías');
    await page.getByRole('tab', { name: 'Grupo y red', exact: true }).click();
  }
  if (
    [
      'Escala uniforme',
      'Escala X',
      'Escala Y',
      'Rotación de aplicación',
      'Fase X',
      'Fase Y',
    ].includes(label)
  ) {
    await context(page, 'Aplicación');
    await page
      .getByRole('complementary', { name: 'Panel contextual' })
      .getByRole('tab', { name: 'Transformar', exact: true })
      .click();
  }
  const exportTabs: Record<string, string> = {
    Representación: 'Precisión',
    'Tolerancia de aproximación': 'Precisión',
    'Convertir trazos a contornos': 'Precisión',
    'Ancho de exportación': 'Tamaño',
    'Alto de exportación': 'Tamaño',
    Resolución: 'Tamaño',
    'Calidad JPEG': 'Tamaño',
    'Fondo transparente': 'Tamaño',
    'Color de fondo de exportación': 'Tamaño',
    Contenido: 'Contenido',
    'Qué exportar': 'Contenido',
    'Aplicación a exportar': 'Contenido',
    'Exportar contornos de teselas': 'Contenido',
  };
  if (exportTabs[label])
    await page
      .getByRole('dialog', { name: 'Exportar patrón' })
      .getByRole('tab', { name: exportTabs[label], exact: true })
      .click();
  const locator = page.getByLabel(label, { exact: true });
  await expect(locator).toBeVisible();
  return locator;
}
