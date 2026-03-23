function onOpen() {
  const ui = SpreadsheetApp.getUi()
  ui.createMenu('📁 Gestión UCP')
    .addItem('🔍 Buscador Paciente(s)', 'mostrarBuscadorCentral')
    .addSeparator()
    .addItem('👤 Nuevo Paciente', 'mostrarSidebarPacientes')
    .addItem('✏️ Editar Paciente', 'mostrarSidebarEditarPaciente')
    .addSeparator()
    .addItem('📝 Registrar Atención', 'mostrarModalAtencion')
    .addItem('⬆️ Subir Documento Firmado', 'mostrarModalSubirDoc')
    .addSeparator()
    .addItem('📥 Re-abastecimiento de Insumos', 'mostrarModalIngresoStock')
    .addToUi()
    
  ui.createMenu('📑 Gestión Cajas')
    .addItem('💰 Procesar CRIs (Cajas)', 'procesarCrisManual')
    .addToUi();

  ui.createMenu('⚠️ Reversiones')
    .addItem('↩️ Anular Atención o Presupuesto', 'revertirAtencion')
    .addItem('↩️ Anular Ingreso de Stock', 'revertirIngresoStock')
    .addItem('↩️ Eliminar CRI (Revertir a Pendiente)', 'revertirCRI')
    .addToUi();

    ui.createMenu('❓ Guía de Uso')
    .addItem('ℹ️ Guía Rápida', 'mostrarGuiaRapida')
    .addItem('📖 Ver Manual de Usuario', 'abrirManualCompleto')
    .addToUi()
}

function mostrarBuscadorCentral() {
  const html = HtmlService.createHtmlOutputFromFile('ModalBuscador')
      .setWidth(550).setHeight(350);
  SpreadsheetApp.getUi().showModelessDialog(html, '🔍 Buscador');
}

// ========== FUNCIONES DE AYUDA AL USUARIO ==========

/**
 * Muestra una ventana emergente (sidebar) con el contenido de GuiaRapida.html.
 */
function mostrarGuiaRapida() {
  const html = HtmlService.createHtmlOutputFromFile('SidebarGuia').setTitle('Guía Rápida').setWidth(350);
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Abre una nueva pestaña en el navegador con el enlace al manual de usuario completo.
 */
function abrirManualCompleto() {
  const url = "https://docs.google.com/document/d/1GsuVIKADsJLDOWNiayv2IQJmhuq-Kb97";  
  const html = HtmlService.createHtmlOutput(`<script>window.open('${url}', '_blank'); google.script.host.close();</script>`).setHeight(10).setWidth(100);
  SpreadsheetApp.getUi().showModelessDialog(html, 'Abriendo Manual...');
}